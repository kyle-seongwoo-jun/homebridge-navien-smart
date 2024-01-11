import { Logger } from 'homebridge';

import { NavienPlatformConfig } from '../platform';
import { NavienAuth } from './navien.auth';
import { Device } from './navien.model';

export class NavienService {
  private readonly auth: NavienAuth;

  constructor(
        private readonly log: Logger,
        private readonly config: NavienPlatformConfig,
  ) {
    this.auth = new NavienAuth(log, config);
  }

  public async getDevices() {
    this.log.debug('Getting devices from Navien API');

    const refreshToken = await this.auth.refreshToken();
    this.log.debug('Refresh token:', refreshToken);

    // TODO: Implement
    const devices = [] as Device[];
    return devices;
  }
}
