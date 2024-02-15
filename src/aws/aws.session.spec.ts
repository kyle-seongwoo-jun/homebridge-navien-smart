import { AwsSession } from './aws.session';

describe('AwsSession', () => {
  it('should create instance', () => {
    const session = new AwsSession(
      'accessKeyId',
      'secretAccessKey',
      'sessionToken',
      3600 * 1000,
    );

    expect(session.accessKeyId).toBe('accessKeyId');
    expect(session.secretAccessKey).toBe('secretAccessKey');
    expect(session.sessionToken).toBe('sessionToken');
    expect(session.hasValidToken()).toBe(true);
  });

  it('should create instance from response', () => {
    const response = {
      accessKeyId: 'accessKeyId',
      secretKey: 'secretAccessKey',
      sessionToken: 'sessionToken',
      authorizationExpiresIn: 3600,
    };
    const session = AwsSession.fromResponse(response);

    expect(session.accessKeyId).toBe('accessKeyId');
    expect(session.secretAccessKey).toBe('secretAccessKey');
    expect(session.sessionToken).toBe('sessionToken');
    expect(session.hasValidToken()).toBe(true);
  });

  it('should validate token', () => {
    const newSession = new AwsSession(
      'accessKeyId',
      'secretAccessKey',
      'sessionToken',
      3600 * 1000,
    );
    const expiredSession = new AwsSession(
      'accessKeyId',
      'secretAccessKey',
      'sessionToken',
      -3600 * 1000,
    );

    expect(newSession.hasValidToken()).toBe(true);
    expect(expiredSession.hasValidToken()).toBe(false);

    expect(expiredSession.isTokenExpired()).toBe(true);
    expect(newSession.isTokenExpired()).toBe(false);
  });
});
