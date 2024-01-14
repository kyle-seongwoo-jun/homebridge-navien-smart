import { Logger } from 'homebridge';
import fetch, { BodyInit, HeadersInit, Response } from 'node-fetch';

import { NavienPlatformConfig } from '../platform';
import { API_URL } from './constants';
import { NavienAuth } from './navien.auth';
import { Device, Login2Data } from './navien.model';
import { DevicesResponse, Login2Response } from './navien.response';
import { Session } from './Session';

type RequestMethods = 'GET' | 'POST';

export class NavienApi {
  private readonly auth: NavienAuth;
  private _session?: Session;
  private _session2?: Login2Data;

  constructor(
    private readonly log: Logger,
    private readonly config: NavienPlatformConfig,
  ) {
    this.auth = new NavienAuth(log);
    this._session = Session.fromConfig(config);
  }

  public async ready(): Promise<boolean> {
    await this.loginStep1();
    await this.loginStep2();

    return !!this._session && !!this._session2;
  }

  private async loginStep1() {
    // no session, login and get access token
    if (!this._session) {
      const { username, password } = this.config;
      const response = await this.auth.login(username, password!);
      this._session = Session.fromResponse(response);
    }

    // session exists but token expired, refresh token
    if (this._session.isTokenExpired()) {
      const response = await this.auth.refreshToken(this._session.refreshToken);
      this._session = this._session.copyWith({
        accessToken: response.data.authInfo.accessToken,
        expiresIn: response.data.authInfo.authenticationExpiresIn,
      });
    }
  }

  private async loginStep2() {
    if (!this._session) {
      throw new Error('should call loginStep1() first.');
    }

    const response = await this.request<Login2Response>('POST', '/users/secured-sign-in', {
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        'userId': this._session.userId,
        'accountSeq': this._session.accountSeq,
      }),
    });

    const { data } = response;
    this._session2 = data;
  }

  private async _request(
    method: RequestMethods,
    path: string,
    options?: {
      headers?: HeadersInit | undefined;
      query?: Record<string, string>;
      body?: BodyInit | undefined;
    },
  ): Promise<Response> {
    const { query, headers, body } = options || {};

    const { accessToken } = this._session || {};
    if (!accessToken) {
      throw new Error('No access token. Please call ready() first.');
    }

    let url = `${API_URL}${path}`;
    if (query) {
      url += `?${new URLSearchParams(query)}`;
    }

    const response = await fetch(url, {
      method: method,
      headers: {
        'Authorization': accessToken,
        ...headers,
      },
      body: body,
    });

    return response;
  }

  private async request<T>(
    method: RequestMethods,
    path: string,
    options?: {
      headers?: HeadersInit | undefined;
      query?: Record<string, string>;
      body?: BodyInit | undefined;
    },
  ): Promise<T> {
    const response = await this._request(method, path, options);

    if (!response.ok) {
      const json = await response.json();
      if (response.status === 401) {
        // login detected from another device
        // TODO: re-login and retry
        this.log.warn('Login detected from another device. We will re-login and retry.', json);
      }
      if (response.status === 403) {
        // token expired
        // TODO: refresh token and retry
        this.log.warn('Token expired. We will refresh token and retry.', json);
      }
      throw new Error(json.msg);
    }

    return response.json() as T;
  }

  public async getDevices(): Promise<Device[]> {
    if (!this._session2) {
      throw new Error('should call ready() first.');
    }

    const response = await this.request<DevicesResponse>('GET', '/devices', {
      query: {
        familySeq: `${this._session2.familySeq}`,
        userSeq: `${this._session2.userSeq}`,
      },
    });

    const { devices } = response.data;
    return devices;
  }
}
