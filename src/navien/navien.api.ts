import assert from 'assert';
import { Logger } from 'homebridge';
import fetch, { BodyInit, HeadersInit, Response } from 'node-fetch';

import { AwsSession } from '../aws/aws-session';
import { NavienPlatformConfig } from '../platform';
import { API_URL } from './constants';
import { ConfigurationException } from './exceptions';
import { NavienAuth } from './navien.auth';
import { Device } from './navien.model';
import { CommonResponse, DevicesResponse, ResponseCode } from './navien.response';
import { Session } from './Session';
import { UserData } from './user-data';

type RequestMethods = 'GET' | 'POST';

export class NavienApi {
  private readonly auth: NavienAuth;
  private _session?: Session;
  private _awsSession?: AwsSession;
  private _userData?: UserData;

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
    const userData = new UserData(userId, accountSeq, userSeq, familySeq);

    // update session
    this._session = session;
    this._awsSession = awsSession;
    this._userData = userData;
  }

  private async _loadSessionWithConfig() {
    const { auth_mode, username, password, account_seq, refresh_token } = this.config;

    if (auth_mode === 'account') {
      // validate config
      if (!password) {
        throw ConfigurationException.empty('password');
      }

      // login with username/password
      const response = await this.auth.login(username, password);

      const session = Session.fromResponse(response);
      return {
        session,
        userId: response.loginId,
        accountSeq: response.userSeq,
      };
    }

    if (auth_mode === 'token') {
      // validate config
      if (!account_seq) {
        throw ConfigurationException.empty('account_seq');
      }
      if (!refresh_token) {
        throw ConfigurationException.empty('refresh_token');
      }

      // refresh token
      const response = await this.auth.refreshToken(refresh_token);
      if (!response.data) {
        throw new ConfigurationException(
          'refresh_token',
          'refresh_token may be expired. Please login again to get new one and update your config.json',
        );
      }

      const session = Session.fromAuthInfo(response.data.authInfo, refresh_token);
      return {
        session,
        userId: username,
        accountSeq: account_seq,
      };
    }

    // should not reach here
    throw ConfigurationException.invalid('auth_mode', auth_mode, { validValue: 'account or token' });
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
    if (!this._userData) {
      throw new Error('should call ready() first.');
    }

    const { familySeq, userSeq } = this._userData;

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
    if (!this._userData) {
      throw new Error('should call ready() first.');
    }

    const { familySeq, userSeq } = this._userData;
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
