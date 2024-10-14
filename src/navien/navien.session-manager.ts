import assert from 'assert';
import { Logger } from 'homebridge';

import { AwsSession } from '../aws/aws.session';
import { NavienPlatformConfig } from '../platform';
import { Persist } from '../utils/persist.util';
import { AuthException, ConfigurationException } from './exceptions';
import { NavienAuth } from './navien.auth';
import { NavienSession } from './navien.session';
import { NavienUser } from './navien.user';

export class NavienSessionManager {
  private _session?: NavienSession;
  private _awsSession?: AwsSession;
  private _user?: NavienUser;

  constructor(
      private readonly log: Logger,
      private readonly auth: NavienAuth,
      private readonly storage: Persist,
      private readonly config: NavienPlatformConfig,
  ) { }

  public get session(): NavienSession | undefined {
    return this._session;
  }

  public get awsSession(): AwsSession | undefined {
    return this._awsSession;
  }

  public get user(): NavienUser | undefined {
    return this._user;
  }

  public async ready() {
    await this.storage.init();

    // load session (stored or with config)
    const { session, userId, accountSeq } = await this._loadSession();

    // login with session
    const response = await this.auth.login2(session.accessToken, userId, accountSeq);
    assert(response.data, 'No data in login2 response.');

    const { userInfo, currentHomeSeq, home, authInfo } = response.data;
    assert(userInfo.userId === userId, 'userId in login2 response does not match.');
    assert(home.length > 0, 'No home in login2 response.');
    this.log.debug('currentHomeSeq:', currentHomeSeq);
    this.log.debug('homes.homeSeq:', home.map(h => h.homeSeq));

    const { userSeq } = userInfo;
    const { homeSeq } = home[0];
    const awsSession = AwsSession.fromResponse(authInfo);
    const user = new NavienUser(userId, accountSeq, userSeq, homeSeq);

    // save session
    this._session = session;
    this._awsSession = awsSession;
    this._user = user;

    await Promise.all([
      this.storage.set('session', session),
      this.storage.set('user', user),
    ]);
  }

  public async refreshSession() {
    const { session } = this;
    if (!session) {
      throw new Error('Please call ready() first.');
    }

    // refresh token
    const response = await this.auth.refreshToken(session.refreshToken);
    if (!response.data) {
      throw new AuthException(`Refresh token may be expired. refreshToken: ${session.refreshToken}`);
    }

    // save new session
    const newSession = this._session = NavienSession.fromAuthInfo(response.data.authInfo, session.refreshToken);
    await this.storage.set('session', session);

    return newSession;
  }

  public async refreshAwsSession() {
    if (!this._session || !this._user) {
      throw new Error('Please call ready() first.');
    }

    // refresh api session if expired
    let session = this._session;
    if (!session.hasValidToken()) {
      session = await this.refreshSession();
    }

    // login to get new aws session
    const { accessToken } = session;
    const { userId, accountSeq } = this._user;
    const response = await this.auth.login2(accessToken, userId, accountSeq);
    assert(response.data, 'No data in login2 response.');

    // save new aws session
    const { authInfo } = response.data;
    const awsSession = this._awsSession = AwsSession.fromResponse(authInfo);

    return awsSession;
  }

  private async _loadSession() {
    let session: NavienSession;
    let userId: string;
    let accountSeq: number;

    // load session from storage
    const saved = await this._loadSessionFromStorage();

    if (saved) {
      ({ session, user: { userId, accountSeq } } = saved);
      this.log.info('Loaded session from storage');
    } else {
      // load session with config
      ({ session, userId, accountSeq } = await this._loadSessionWithConfig());
      this.log.info('Loaded session with config');
    }

    return { session, userId, accountSeq };
  }

  private async _loadSessionFromStorage() {
    // load session and user from storage
    let session: NavienSession | undefined;
    let user: NavienUser | undefined;
    try {
      session = await this.storage.get('session', { deserialize: NavienSession.fromJSON });
      user = await this.storage.get('user', { deserialize: NavienUser.fromJSON });
    } catch (error) {
      // reach here if json schema is changed to new version
      // return undefined to force re-login
      this.log.warn('Failed to load session from storage:', error);
      return undefined;
    }

    // no saved session
    if (!session || !user) {
      this.log.info('No saved session found.'); // may be first run
      return undefined;
    }

    const { authMode, username, accountSeq, refreshToken } = this.config;

    // config changed
    if (user.userId !== username
        || (authMode === 'token' && (user.accountSeq !== accountSeq || session.refreshToken !== refreshToken))
    ) {
      this.log.warn('saved session is not matched with config.');
      return undefined;
    }

    // refresh token if expired
    if (session.isTokenExpired()) {
      const response = await this.auth.refreshToken(session.refreshToken);

      // saved refresh token may be expired
      if (!response.data) {
        this.log.warn('saved refresh token may be expired.');
        return undefined;
      }

      session = NavienSession.fromAuthInfo(response.data.authInfo, session.refreshToken);
    }

    return { session, user };
  }

  private async _loadSessionWithConfig() {
    const { authMode, username, password, accountSeq, refreshToken } = this.config;

    if (authMode === 'account') {
      // validate config
      if (!password) {
        throw ConfigurationException.empty('password');
      }

      // login with username/password
      const response = await this.auth.login(username, password);

      const session = NavienSession.fromResponse(response);
      return {
        session,
        userId: response.loginId,
        accountSeq: response.userSeq,
      };
    }

    if (authMode === 'token') {
      // validate config
      if (!accountSeq) {
        throw ConfigurationException.empty('accountSeq');
      }
      if (!refreshToken) {
        throw ConfigurationException.empty('refreshToken');
      }

      // refresh token
      const response = await this.auth.refreshToken(refreshToken);
      if (!response.data) {
        throw new ConfigurationException(
          'refreshToken',
          'refreshToken may be expired. Please login again to get new one and update your config.json',
        );
      }

      const session = NavienSession.fromAuthInfo(response.data.authInfo, refreshToken);
      return {
        session,
        userId: username,
        accountSeq: accountSeq,
      };
    }

    // should not reach here
    throw ConfigurationException.invalid('authMode', authMode, { validValue: 'account or token' });
  }
}
