import fetchCookie from 'fetch-cookie';
import { Logger } from 'homebridge';
import fetch from 'node-fetch';
import { URLSearchParams } from 'url';

import { API_URL, LOGIN_API_URL, USER_AGENT } from './constants';
import { CommonResponse, Login2Response, LoginResponse, RefreshTokenResponse } from './interfaces';

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

    // extract json from html
    const jsonLine = html.split('\n').filter(line => line.includes('var message = '))[0].trim();
    const index1 = jsonLine.indexOf('{');
    const index2 = jsonLine.lastIndexOf('}');
    const json = jsonLine.substring(index1, index2 + 1);

    // parse json
    const loginResponse = JSON.parse(json) as LoginResponse;
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
}
