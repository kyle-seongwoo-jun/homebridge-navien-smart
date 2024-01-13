import { Logger } from 'homebridge';
import fetch from 'node-fetch';

import { API_URL } from './constants';
import { Device } from './navien.model';
import { DevicesResponse } from './navien.response';

export class NavienApi {
  constructor(
    private readonly log: Logger,
  ) { }

  async getDevices(accessToken: string): Promise<Device[]> {
    const url = `${API_URL}/device?${new URLSearchParams({
      familySeq: '',
      userSeq: '',
    })}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': accessToken,
      },
    });

    const json = await response.json() as DevicesResponse;
    return json.data.devices;
  }
}