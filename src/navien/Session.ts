import { TokenAuthInfo } from './navien.model';
import { LoginResponse } from './navien.response';

export class Session {
  private readonly expiresOn: number; // milliseconds

  constructor(
      private readonly _accessToken: string,
      private readonly _refreshToken: string,
      expiresIn: number, // milliseconds
  ) {
    this.expiresOn = (Date.now() + expiresIn);
  }

  static fromResponse(response: LoginResponse): Session {
    return new Session(
      response.accessToken,
      response.refreshToken,
      response.authenticationExpiresIn,
    );
  }

  static fromAuthInfo(authInfo: TokenAuthInfo, refreshToken: string): Session {
    return new Session(
      authInfo.accessToken,
      refreshToken,
      authInfo.authenticationExpiresIn * 1000,
    );
  }

  public get accessToken(): string {
    return this._accessToken;
  }

  public get refreshToken(): string {
    return this._refreshToken;
  }

  public hasToken(): boolean {
    return !!this._accessToken;
  }

  public isTokenExpired(): boolean {
    return this.expiresOn < Date.now();
  }

  public hasValidToken(): boolean {
    return this.hasToken() && !this.isTokenExpired();
  }
}
