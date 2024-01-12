import { Logger } from 'homebridge';

import { NavienPlatformConfig } from '../platform';
import { NavienApi } from './navien.api';
import { NavienAuth } from './navien.auth';
import { Session } from './Session';

export class NavienService {
  private readonly auth: NavienAuth;
  private readonly api: NavienApi;
  private _session?: Session;

  constructor(
        private readonly log: Logger,
        private readonly config: NavienPlatformConfig,
  ) {
    this.auth = new NavienAuth(log);
    this.api = new NavienApi(log);
    this._session = Session.fromConfig(config);
  }

  async getAccessToken() {
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

    return this._session.accessToken;
  }

  public async getDevices() {
    this.log.debug('Getting devices from Navien API');

    const accessToken = await this.getAccessToken();
    this.log.debug('Access token:', accessToken);

    const devices = await this.api.getDevices(accessToken);
    this.log.debug('Devices:', devices.map((device) => device.Properties.nickName.mainItem));

    return devices;
  }
}
