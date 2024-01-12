import fetchCookie from 'fetch-cookie';
import { Logger } from 'homebridge';
import nodeFetch from 'node-fetch';
import { URLSearchParams } from 'url';

import { LoginResponse, RefreshTokenResponse } from './navien.response';

const API_URL = 'https://nskr.naviensmartcontrol.com/api/v1.0';
const LOGIN_API_URL = 'https://member.naviensmartcontrol.com';
// eslint-disable-next-line max-len
const USER_AGENT = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 APP_NAVIENSMART_IOS';

export class NavienAuth {
  constructor(
    private readonly log: Logger,
  ){ }

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

  async refreshToken(refreshToken: string): Promise<RefreshTokenResponse> {
    this.log.debug(`Refreshing token with refreshToken: ${refreshToken}`);

    const fetch = nodeFetch;
    const response = await fetch(`${API_URL}/auth/token/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        'refreshToken': refreshToken,
      }),
    });

    const json = await response.json() as RefreshTokenResponse;
    return json;
  }
}
