import fetchCookie from 'fetch-cookie';
import { Logger } from 'homebridge';
import nodeFetch from 'node-fetch';
import { URLSearchParams } from 'url';

import { NavienPlatformConfig } from '../platform';
import { LoginResponse } from './navien.model';

const LOGIN_API_URL = 'https://member.naviensmartcontrol.com';
// eslint-disable-next-line max-len
const USER_AGENT = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 APP_NAVIENSMART_IOS';

export class NavienAuth {
  private _refreshToken?: string;

  constructor(
          private readonly log: Logger,
          private readonly config: NavienPlatformConfig,
  ) {
    if (config.auth_mode === 'token') {
      this._refreshToken = config.refresh_token;
    }
  }

  async refreshToken() {
    if (this._refreshToken) {
      return this._refreshToken;
    }

    const { username, password } = this.config;
    const token = this._refreshToken = await this.login(username, password).then(response => response.refreshToken);

    this.saveToken(token);

    return token;
  }

  async login(username: string, password: string): Promise<LoginResponse> {
    this.log.debug(`Logging in with username: ${username}, password: ${password}`);

    // request login
    // this will redirect to /member/loginOk and it requires cookie so we use fetch-cookie
    const fetch = fetchCookie(nodeFetch);
    const response = await fetch(`${LOGIN_API_URL}/member/login`, {
      method: 'POST',
      headers: {
        'User-Agent': USER_AGENT,
        'Origin': LOGIN_API_URL,
        'Referer': `${LOGIN_API_URL}/member/login`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        'username': username,
        'password': password,
      }),
      redirect: 'follow',
    });
    const html = await response.text();

    // extract json from html
    const jsonLine = html.split('\n').filter(line => line.includes('var message = '))[0].trim();
    const index1 = jsonLine.indexOf('{');
    const index2 = jsonLine.lastIndexOf('}');
    const json = jsonLine.substring(index1, index2 + 1);

    // parse json
    const loginResponse = JSON.parse(json) as LoginResponse;
    return loginResponse;
  }

  async saveToken(token: string) {
    // TODO: Implement
  }
}
