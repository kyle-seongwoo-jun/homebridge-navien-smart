import assert from 'assert';
import { Logger } from 'homebridge';
import fetch, { BodyInit, HeadersInit, Response } from 'node-fetch';

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
      throw ApiException.from(json);
    }

    return response.json() as T;
  }

  public async getDevices(): Promise<Device[]> {
    if (!this.user) {
      throw new Error('should call ready() first.');
    }

    const { familySeq, userSeq } = this.user;

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

  private async controlDevice(device: Device, payload?: Record<string, unknown>) {
    if (!this.user) {
      throw new Error('should call ready() first.');
    }

    const { familySeq, userSeq } = this.user;
    const { serviceCode, deviceId, deviceSeq, modelCode } = device;

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

  public setPower(device: Device, power: boolean) {
    return this.controlDevice(device, {
      operationMode: power ? 1 : 0,
    });
  }

  public setTemperature(device: Device, temperature: number) {
    const {
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
    });
  }
}
