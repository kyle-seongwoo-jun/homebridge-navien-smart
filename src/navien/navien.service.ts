import { Logger } from 'homebridge';

import { NavienPlatformConfig } from '../platform';
import { NavienApi } from './navien.api';
import { NavienAuth } from './navien.auth';
import { Device } from './navien.model';

export class NavienService {
  private readonly auth: NavienAuth;
  private readonly api: NavienApi;

  constructor(
    private readonly log: Logger,
    private readonly config: NavienPlatformConfig,
  ) {
    this.auth = new NavienAuth(log);
    this.api = new NavienApi(log, config);
  }

  public async ready() {
    this.log.debug('Checking if Navien API is ready');
    return this.api.ready();
  }

  public async getDevices() {
    this.log.debug('Getting devices from Navien API');

    const devices = await this.api.getDevices().catch((error) => {
      this.log.error('Error while getting devices from Navien API:', error);
      return [] as Device[];
    });
    this.log.debug('Devices:', devices.map((device) => device.Properties.nickName.mainItem));

    return devices;
  }
}
