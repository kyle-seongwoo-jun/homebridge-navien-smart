import assert from 'assert';
import { Logging } from 'homebridge';
import fetch, { BodyInit, HeadersInit, Response } from 'node-fetch';

import { HeaterItemState, OperationMode } from '../aws/interfaces/index.js';
import { API_URL } from './constants.js';
import { ApiException } from './exceptions/api.exception.js';
import { CommonResponse, Device, DevicesResponse, ResponseCode } from './interfaces/index.js';
import { NavienSession } from './navien.session.js';
import { NavienSessionManager } from './navien.session-manager.js';
import { NavienUser } from './navien.user.js';

type RequestMethods = 'GET' | 'POST';

export type HeatingZone = 'single' | 'left' | 'right';

type TemperatureParam = {
  enable: boolean;
  temperature: number;
};

type TemperatureParams = Partial<Record<HeatingZone, TemperatureParam>>;

export class NavienApi {

  constructor(
    private readonly log: Logging,
    private readonly sessionManager: NavienSessionManager,
    private readonly soundEnabled: boolean,
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
              beep: this.soundEnabled,
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

  public setTemperature(device: Device, params: TemperatureParams) {
    const { single, left, right } = params;

    // create heater payload
    const heaterItem = (item: TemperatureParam) => (<HeaterItemState>{
      enable: item.enable,
      temperature: {
        set: item.temperature,
      },
    });

    const enable = single?.enable || left?.enable || right?.enable;
    return this.controlDevice(device, {
      operationMode: enable ? OperationMode.ON : undefined,
      heater: {
        single: single ? heaterItem(single) : undefined,
        left: left ? heaterItem(left) : undefined,
        right: right ? heaterItem(right) : undefined,
      },
    });
  }

  public setChildLock(device: Device, isLocked: boolean) {
    return this.controlDevice(device, {
      childLock: isLocked,
    });
  }
}
