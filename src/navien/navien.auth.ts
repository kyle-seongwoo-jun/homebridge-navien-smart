import fetchCookie from 'fetch-cookie';
import { Logger } from 'homebridge';
import fetch from 'node-fetch';
import { URLSearchParams } from 'url';

import { API_URL, LOGIN_API_URL, USER_AGENT } from './constants';
import { ApiException, AuthException } from './exceptions';
import { CommonResponse, Login2Response, LoginResponse, RefreshTokenResponse, ResponseCode } from './interfaces';

export class NavienAuth {
  constructor(
    private readonly log: Logger,
  ) { }

  async login(username: string, password: string): Promise<LoginResponse> {
    this.log.debug(`Logging in with username: ${username}, password: ${password}`);

    // request login
    // this will redirect to /member/loginOk and it requires cookie so we use fetch-cookie
    const fetchWithCookies = fetchCookie(fetch);
    const response = await fetchWithCookies(`${LOGIN_API_URL}/member/login`, {
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

    // check if login is successful
    this._validateLoginHtml(html);

    // extract json from html
    const jsonString = this._extractJsonFromHtml(html);

    // throw exception if json is not found
    if (!jsonString) {
      throw new AuthException('Username or password is incorrect.');
    }

    // parse json
    const loginResponse = JSON.parse(jsonString) as LoginResponse;
    return loginResponse;
  }

  async login2(accessToken: string, userId: string, accountSeq: number): Promise<Login2Response> {
    this.log.debug(`Logging in with accessToken: ${accessToken}, userId: ${userId}, accountSeq: ${accountSeq}`);

    const response = await fetch(`${API_URL}/users/secured-sign-in`, {
      method: 'POST',
      headers: {
        'Authorization': accessToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        'userId': userId,
        'accountSeq': accountSeq,
      }),
    });

    const json = await response.json() as Login2Response;
    if (json.code !== ResponseCode.SUCCESS) {
      throw ApiException.from(json);
    }

    return json;
  }

  async refreshToken(refreshToken: string): Promise<RefreshTokenResponse> {
    this.log.debug(`Refreshing token with refreshToken: ${refreshToken}`);

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

  async verifyToken(accessToken: string, userSeq: number): Promise<CommonResponse> {
    this.log.debug(`Verifying token with accessToken: ${accessToken}`);

    const response = await fetch(`${API_URL}/users/${userSeq}/session/verify`, {
      method: 'POST',
      headers: {
        'Authorization': accessToken,
      },
    });

    const json = await response.json() as CommonResponse;
    return json;
  }

  private _validateLoginHtml(html: string): void {
    if (!html.includes('id="loginFailPopup" style="display:none;"')) {
      return;
    }

    if (!html.includes('입력한 정보가 일치하지 않습니다.')) {
      throw new AuthException('Username is incorrect.');
    }

    const match = html.match(/현재 (\d)회/);
    if (match) {
      const count = parseInt(match[1]);
      throw new AuthException(`Password is incorrect. If you fail 5 times, you need to reset your password to login. (current: ${count})`);
    }

    throw new AuthException('Password is incorrect. You need to reset your password to login.');
  }

  private _extractJsonFromHtml(html: string): string | undefined {
    const jsonLines = html.split('\n').filter(line => line.includes('var message = '));
    if (jsonLines.length === 0) {
      return undefined;
    }

    const jsonLine = jsonLines[0].trim();
    const index1 = jsonLine.indexOf('{');
    const index2 = jsonLine.lastIndexOf('}');
    const jsonString = jsonLine.substring(index1, index2 + 1);
    return jsonString;
  }
}
