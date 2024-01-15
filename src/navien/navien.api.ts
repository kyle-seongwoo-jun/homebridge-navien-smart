import assert from 'assert';
import { Logger } from 'homebridge';
import fetch, { BodyInit, HeadersInit, Response } from 'node-fetch';

import { AwsSession } from '../aws/aws.session';
import { NavienPlatformConfig } from '../platform';
import { API_URL } from './constants';
import { ConfigurationException } from './exceptions';
import { CommonResponse, Device, DevicesResponse, ResponseCode } from './interfaces';
import { NavienAuth } from './navien.auth';
import { NavienSession } from './navien.session';
import { NavienUser } from './navien.user';

type RequestMethods = 'GET' | 'POST';

export class NavienApi {
  private readonly auth: NavienAuth;
  private _session?: NavienSession;
  private _awsSession?: AwsSession;
  private _user?: NavienUser;

  constructor(
    private readonly log: Logger,
    private readonly config: NavienPlatformConfig,
  ) {
    this.auth = new NavienAuth(log);
  }

  public async ready() {
    // load session with config
    const { session, userId, accountSeq } = await this._loadSessionWithConfig();

    // login with session
    const response = await this.auth.login2(session.accessToken, userId, accountSeq);
    assert(response.data, 'No data in login2 response.');

    const { familySeq, userSeq, authInfo } = response.data;
    const awsSession = AwsSession.fromResponse(authInfo);
    const user = new NavienUser(userId, accountSeq, userSeq, familySeq);

    // update session
    this._session = session;
    this._awsSession = awsSession;
    this._user = user;
  }

  private async _loadSessionWithConfig() {
    const { authMode, username, password, accountSeq, refreshToken } = this.config;

    if (authMode === 'account') {
      // validate config
      if (!password) {
        throw ConfigurationException.empty('password');
      }

      // login with username/password
      const response = await this.auth.login(username, password);

      const session = NavienSession.fromResponse(response);
      return {
        session,
        userId: response.loginId,
        accountSeq: response.userSeq,
      };
    }

    if (authMode === 'token') {
      // validate config
      if (!accountSeq) {
        throw ConfigurationException.empty('accountSeq');
      }
      if (!refreshToken) {
        throw ConfigurationException.empty('refreshToken');
      }

      // refresh token
      const response = await this.auth.refreshToken(refreshToken);
      if (!response.data) {
        throw new ConfigurationException(
          'refreshToken',
          'refreshToken may be expired. Please login again to get new one and update your config.json',
        );
      }

      const session = NavienSession.fromAuthInfo(response.data.authInfo, refreshToken);
      return {
        session,
        userId: username,
        accountSeq: accountSeq,
      };
    }

    // should not reach here
    throw ConfigurationException.invalid('authMode', authMode, { validValue: 'account or token' });
  }

  private async _request(
    method: RequestMethods,
    path: string,
    options: {
      headers?: HeadersInit | undefined;
      query?: Record<string, string>;
      body?: BodyInit | undefined;
    } = {},
  ): Promise<Response> {
    const { query, headers, body } = options;

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
    if (!this._user) {
      throw new Error('should call ready() first.');
    }

    const { familySeq, userSeq } = this._user;

    const response = await this.request<DevicesResponse>('GET', '/devices', {
      query: {
        familySeq: `${familySeq}`,
        userSeq: `${userSeq}`,
      },
    });
    assert(response.data, 'No data in devices response.');

    const { devices } = response.data;
    return devices;
  }

  private async controlDevice(device: Device, payload: unknown) {
    if (!this._user) {
      throw new Error('should call ready() first.');
    }

    const { familySeq, userSeq } = this._user;
    const { serviceCode, deviceId, deviceSeq } = device;

    const response = await this.request<CommonResponse>('POST', `/devices/${deviceSeq}/control`, {
      query: {
        familySeq: `${familySeq}`,
        userSeq: `${userSeq}`,
      },
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        serviceCode: serviceCode,
        topic: `$aws\\/things\\/${deviceId}\\/shadow\\/name\\/status\\/update`,
        payload: payload,
      }).replace(/\\\\/g, '\\'), // \\/ -> \/ in topic
    });

    return response.code === ResponseCode.SUCCESS;
  }

  public setPower(device: Device, power: boolean) {
    const { modelCode } = device;

    return this.controlDevice(device, {
      state: {
        desired: {
          event: {
            modelCode: parseInt(modelCode),
          },
          operationMode: power ? 1 : 0,
        },
      },
    });
  }

  public setTemperature(device: Device, temperature: number) {
    const {
      modelCode,
      Properties: {
        registry: {
          attributes: {
            functions: {
              heatControl,
            },
          },
        },
      },
    } = device;

    // validate temperature
    const { rangeMin, rangeMax, unit } = heatControl;
    if (temperature < rangeMin || temperature > rangeMax) {
      throw new Error(`Temperature must be between ${rangeMin} and ${rangeMax}. current: ${temperature}`);
    }
    if (temperature % parseFloat(unit) !== 0) {
      throw new Error(`Temperature must be multiple of ${unit}. current: ${temperature}`);
    }

    return this.controlDevice(device, {
      state: {
        desired: {
          event: {
            modelCode: parseInt(modelCode),
          },
          heater: {
            left: {
              enable: true,
              temperature: {
                set: temperature,
              },
            },
            right: {
              enable: true,
              temperature: {
                set: temperature,
              },
            },
          },
        },
      },
    });
  }
}
