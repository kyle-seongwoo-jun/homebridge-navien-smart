import { AwsAuthInfo } from '../navien/interfaces';

export class AwsSession {
  private readonly expiresAt: number; // milliseconds

  constructor(
      readonly accessKeyId: string,
      readonly secretAccessKey: string,
      readonly sessionToken: string,
      expiresIn: number, // milliseconds
  ) {
    this.expiresAt = (Date.now() + expiresIn);
  }

  static fromResponse(response: AwsAuthInfo): AwsSession {
    return new AwsSession(
      response.accessKeyId,
      response.secretKey,
      response.sessionToken,
      response.authorizationExpiresIn * 1000,
    );
  }

  public isTokenExpired(): boolean {
    return this.expiresAt < Date.now();
  }

  public hasValidToken(): boolean {
    return !this.isTokenExpired();
  }
}
