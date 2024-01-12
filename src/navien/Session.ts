import { NavienPlatformConfig } from '../platform';
import { LoginResponse } from './navien.response';

export class Session {
  private readonly expiresOn: number;

  constructor(
      private readonly _accessToken: string,
      private readonly _refreshToken: string,
      expiresIn: number,
      private readonly _userId: string,
      private readonly _accountSeq: number,
  ) {
    this.expiresOn = (Date.now() + expiresIn);
  }

  static fromResponse(response: LoginResponse): Session {
    return new Session(
      response.accessToken,
      response.refreshToken,
      response.authenticationExpiresIn,
      response.loginId,
      response.userSeq,
    );
  }

  static fromConfig(config: NavienPlatformConfig): Session | undefined {
    if (config.auth_mode === 'token') {
      const { username, refresh_token, account_seq } = config;
      return new Session(
        '',
        refresh_token!,
        0,
        username,
        account_seq!,
      );
    }

    return undefined;
  }

  public copyWith(options: { accessToken: string; expiresIn: number }): Session {
    return new Session(
      options.accessToken,
      this._refreshToken,
      options.expiresIn,
      this._userId,
      this._accountSeq,
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
    return this.expiresOn < Session.getCurrentEpoch();
  }

  public hasValidToken(): boolean {
    return this.hasToken() && !this.isTokenExpired();
  }

  private static getCurrentEpoch(): number {
    return Math.round(new Date().getTime() / 1000);
  }
}