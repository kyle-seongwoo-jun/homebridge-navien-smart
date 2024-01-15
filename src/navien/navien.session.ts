import { LoginResponse, TokenAuthInfo } from './interfaces';

export class NavienSession {
  constructor(
      readonly accessToken: string,
      readonly refreshToken: string,
      readonly expiresAt: number, // milliseconds
  ) { }

  static from(
    accessToken: string,
    refreshToken: string,
    expiresIn: number, // milliseconds
  ): NavienSession {
    return new NavienSession(
      accessToken,
      refreshToken,
      Date.now() + expiresIn,
    );
  }

  static fromJSON(json: unknown): NavienSession {
    if (typeof json !== 'object' || json === null) {
      throw new Error('Invalid JSON for NavienUser');
    }

    const { accessToken, refreshToken, expiresAt } = json as NavienSession;
    if (!accessToken || !refreshToken || !expiresAt) {
      throw new Error('Invalid JSON for NavienUser');
    }

    return new NavienSession(accessToken, refreshToken, expiresAt);
  }

  static fromResponse(response: LoginResponse): NavienSession {
    return NavienSession.from(
      response.accessToken,
      response.refreshToken,
      response.authenticationExpiresIn,
    );
  }

  static fromAuthInfo(authInfo: TokenAuthInfo, refreshToken: string): NavienSession {
    return NavienSession.from(
      authInfo.accessToken,
      refreshToken,
      authInfo.authenticationExpiresIn * 1000,
    );
  }

  public hasToken(): boolean {
    return !!this.accessToken;
  }

  public isTokenExpired(): boolean {
    return this.expiresAt < Date.now();
  }

  public hasValidToken(): boolean {
    return this.hasToken() && !this.isTokenExpired();
  }
}
