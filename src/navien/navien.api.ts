import assert from 'assert';
import { Logger } from 'homebridge';
import fetch, { BodyInit, HeadersInit, Response } from 'node-fetch';

import { OperationMode } from '../aws/interfaces';
import { API_URL } from './constants';
import { ApiException } from './exceptions';
import { CommonResponse, Device, DevicesResponse, ResponseCode } from './interfaces';
import { NavienSession } from './navien.session';
import { NavienSessionManager } from './navien.session-manager';
import { NavienUser } from './navien.user';

type RequestMethods = 'GET' | 'POST';

export class NavienApi {
  constructor(
    private readonly log: Logger,
    private readonly sessionManager: NavienSessionManager,
  ) { }

  private get session(): NavienSession | undefined {
    return this.sessionManager.session;
  }

  private get user(): NavienUser | undefined {
    return this.sessionManager.user;
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

    const { accessToken } = this.session || {};
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
      const json = await response.json() as CommonResponse;
      // login detected from another device
      if (json.code === ResponseCode.COMMON_NOT_AUTHORIZED) {
        this.log.error('Login detected from another device.');
        // TODO: re-login and retry if authMode is 'account'
      }
      // token expired
      if (json.code === ResponseCode.COMMON_TOKEN_EXPIRED) {
        this.log.warn('Token expired. We will refresh token and retry.');

        // refresh token and retry
        await this.sessionManager.refreshSession();
        return await this.request(method, path, options);
      }
      throw ApiException.from(json);
    }

    return response.json() as T;
  }

  public async getDevices(): Promise<Device[]> {
    if (!this.user) {
      throw new Error('should call ready() first.');
    }

    const { homeSeq, userSeq } = this.user;

    const response = await this.request<DevicesResponse>('GET', '/devices', {
      query: {
        homeSeq: `${homeSeq}`,
        userSeq: `${userSeq}`,
      },
    });
    assert(response.data, 'No data in devices response.');

    const { devices } = response.data;
    return devices;
  }

  private async controlDevice(device: Device, payload?: Record<string, unknown>) {
    if (!this.user) {
      throw new Error('should call ready() first.');
    }

    const { homeSeq, userSeq } = this.user;
    const { serviceCode, deviceId, deviceSeq, modelCode } = device;

    const response = await this.request<CommonResponse>('POST', `/devices/${deviceSeq}/control`, {
      query: {
        homeSeq: `${homeSeq}`,
        userSeq: `${userSeq}`,
      },
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        serviceCode: serviceCode,
        topic: `$aws\\/things\\/${deviceId}\\/shadow\\/name\\/status\\/update`,
        payload: {
          state: {
            desired: {
              event: {
                modelCode: parseInt(modelCode),
              },
              ...payload,
            },
          },
        },
      }).replace(/\\\\/g, '\\'), // \\/ -> \/ in topic
    });

    // validate response
    if (response.code !== ResponseCode.SUCCESS) {
      throw ApiException.from(response);
    }
  }


  public initializeDevice(device: Device) {
    return this.controlDevice(device);
  }

  public setOperationMode(device: Device, value: OperationMode) {
    return this.controlDevice(device, {
      operationMode: value,
    });
  }

  public setTemperature(device: Device, temperature: number, range: { min: number; max: number; step: number }) {
    // validate temperature
    const { min, max, step } = range;
    if (temperature < min || temperature > max) {
      throw new Error(`Temperature must be between ${min} and ${max}. current: ${temperature}`);
    }
    if (temperature % step !== 0) {
      throw new Error(`Temperature must be multiple of ${step}. current: ${temperature}`);
    }

    return this.controlDevice(device, {
      heater: {
        left: {
          enable: temperature > min,
          temperature: {
            set: temperature,
          },
        },
        right: {
          enable: temperature > min,
          temperature: {
            set: temperature,
          },
        },
      },
    });
  }

  public setChildLock(device: Device, isLocked: boolean) {
    return this.controlDevice(device, {
      childLock: isLocked,
    });
  }
}
