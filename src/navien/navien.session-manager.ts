import assert from 'assert';
import { Logging } from 'homebridge';

import { AwsSession } from '../aws/aws.session';
import { NavienPlatformConfig } from '../platform';
import { Persist } from '../utils/persist.util';
import { AuthException, ConfigurationException } from './exceptions';
import { NavienAuth } from './navien.auth';
import { NavienSession } from './navien.session';
import { NavienUser } from './navien.user';

/**
 * Manages authentication sessions for the Navien API and AWS IoT.
 *
 * This class handles:
 * - Session initialization and storage
 * - Token refresh and management
 * - User authentication state
 * - AWS IoT session management
 *
 * Authentication can be done in two ways:
 * 1. Account credentials (username/password)
 * 2. Refresh token
 *
 * The session manager maintains:
 * - NavienSession: Contains access/refresh tokens for API auth
 * - AwsSession: Contains credentials for AWS IoT connectivity
 * - NavienUser: Contains user identification info
 *
 * Sessions are persisted to storage and can be restored between plugin restarts.
 * Token refresh is handled automatically when tokens expire.
 */
export class NavienSessionManager {
  private _session?: NavienSession;
  private _awsSession?: AwsSession;
  private _user?: NavienUser;

  constructor(
    private readonly log: Logging,
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


  /**
   * Initializes the session manager by:
   * 1. Loading session from storage or config.json
   * 2. Performing token login with the loaded session
   * 3. If token login fails, refreshes token and retries
   * 4. Saves the valid session and user info to storage
   *
   * The session can be loaded from:
   * - Previously saved session in storage
   * - Config.json using account credentials
   * - Config.json using refresh token
   *
   * @throws {ConfigurationException} If required config values are missing
   * @throws {AuthException} If authentication fails
   */
  public async ready() {
    await this.storage.init();

    // load session (from stored or config)
    const {
      session: loadedSession,
      userId,
      accountSeq,
    } = await this._loadSession();

    // login with session
    let session = loadedSession;
    const { userInfo, currentHomeSeq, home, authInfo } = await this._tokenLogin(
      session, userId, accountSeq,
      { onTokenRefreshed: (newSession) => session = newSession },
    );
    assert(userInfo.userId === userId, 'userId in token-login response does not match.');
    assert(home.length > 0, 'No home in token-login response.');
    this.log.debug('currentHomeSeq:', currentHomeSeq);
    this.log.debug('homes.homeSeq:', home.map(h => h.homeSeq));

    const { userSeq } = userInfo;
    const { homeSeq } = home[0];
    const awsSession = AwsSession.fromResponse(authInfo);
    const user = new NavienUser(userId, accountSeq, userSeq, homeSeq);

    // save session
    await this._saveSession({ session, awsSession, user });
  }

  /**
   * Refreshes the current session by requesting a new access token using the refresh token.
   *
   * This method:
   * 1. Checks if there is an active session
   * 2. Requests a new access token using the current refresh token
   * 3. Creates a new session with the refreshed token info
   * 4. Saves the new session to storage
   *
   * @returns {Promise<NavienSession>} A new session with refreshed access token
   * @throws {Error} If ready() has not been called first
   * @throws {ConfigurationException} If the refresh token is expired or invalid
   */
  public async refreshSession(): Promise<NavienSession> {
    const { session } = this;
    if (!session) {
      throw new Error('Please call ready() first.');
    }

    // refresh token
    const response = await this.auth.refreshToken(session.refreshToken);
    if (!response.data) {
      // saved refresh token has expired
      throw new ConfigurationException(
        'refreshToken',
        'refreshToken has expired. Please login again to get new one and update your config.json',
      );
    }

    // save new session
    const newSession = NavienSession.fromAuthInfo(response.data.authInfo, session.refreshToken);
    await this._saveSession({ session: newSession });

    return newSession;
  }

  /**
   * Refreshes the current AWS IoT session by:
   * 1. Checking if there is an active session
   * 2. Refreshing the Navien API session if expired
   * 3. Logging in to get a new AWS IoT session
   *
   * @returns {Promise<AwsSession>} A new AWS IoT session
   * @throws {Error} If ready() has not been called first
   */
  public async refreshAwsSession(): Promise<AwsSession> {
    if (!this._session || !this._user) {
      throw new Error('Please call ready() first.');
    }

    // refresh api session if expired
    let session = this._session;
    if (!session.hasValidToken()) {
      session = await this.refreshSession();
    }

    // login to get new aws session
    let newSession: NavienSession | undefined;
    const { userId, accountSeq } = this._user;
    const { authInfo } = await this._tokenLogin(session, userId, accountSeq, {
      onTokenRefreshed: (session) => newSession = session,
    });

    // save new aws session
    const awsSession = AwsSession.fromResponse(authInfo);
    await this._saveSession({ session: newSession, awsSession });

    return awsSession;
  }

  /**
   * Loads or creates a session by checking storage first, then config if needed.
   * If a valid session exists in storage, it will be used. Otherwise creates
   * a new session using authentication info from config.json
   *
   * @returns Session info containing session, userId and accountSeq
   * @throws ConfigurationException if required config values are missing or refresh token is expired
   * @throws AuthException if authentication fails
   */
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

  /**
   * Loads user and session objects by deserializing data from storage.
   * Returns `undefined` if:
   * - No saved data exists
   * - Deserialization fails
   * - Current config differs from config at time of storage
   *
   * @returns Object containing session and user if successful, undefined otherwise
   * @throws {ConfigurationException} when refresh token is expired
   */
  private async _loadSessionFromStorage() {
    // deserialize data from storage
    let session: NavienSession | undefined;
    let user: NavienUser | undefined;
    try {
      session = await this.storage.get('session', { deserialize: NavienSession.fromJSON });
      user = await this.storage.get('user', { deserialize: NavienUser.fromJSON });
    } catch (error) {
      // reach here if json schema is changed to new version
      // return undefined to force re-login
      this.log.warn('Failed to load session from storage:', error);
      await this.storage.clear();
      return undefined;
    }

    // no saved session
    if (!session || !user) {
      this.log.info('No saved session found.'); // may be first run
      return undefined;
    }

    // config has changed
    const config = this.config;
    if (config.username !== user.userId || (
      config.authMode === 'token' && (
        config.accountSeq !== user.accountSeq ||
        config.refreshToken !== session.refreshToken
      )
    )) {
      this.log.warn('saved session is not matched with config.');
      await this.storage.clear();
      return undefined;
    }

    // refresh token if expired
    if (session.isTokenExpired()) {
      const response = await this.auth.refreshToken(session.refreshToken);
      if (!response.data) {
        // saved refresh token has expired
        if (config.authMode === 'token') {
          throw new ConfigurationException(
            'refreshToken',
            'refreshToken has expired. Please login again to get new one and update your config.json',
          );
        }
        // if auth mode is account, just ignore expired refresh token
        this.log.warn('saved refresh token has expired.');
        await this.storage.clear();
        return undefined;
      }

      session = NavienSession.fromAuthInfo(response.data.authInfo, session.refreshToken);
    }

    return { session, user };
  }

  /**
   * Load session from config.json based on auth mode
   * - For 'account' mode: Login using ID and password
   * - For 'token' mode: Generate new access token using refresh token
   *
   * @returns Session info including session, userId and accountSeq
   * @throws ConfigurationException if required config values are missing or invalid
   */
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

      // generate new access token
      const response = await this.auth.refreshToken(refreshToken);
      if (!response.data) {
        throw new ConfigurationException(
          'refreshToken',
          'refreshToken has expired. Please login again to get new one and update your config.json',
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

  /**
   * Saves the session and user info to storage.
   */
  private async _saveSession({ session, awsSession, user }: { session?: NavienSession; awsSession?: AwsSession; user?: NavienUser }) {
    this.log.debug('Saving session:', { session, awsSession, user });

    // update fields if provided
    this._session = session ?? this._session;
    this._awsSession = awsSession ?? this._awsSession;
    this._user = user ?? this._user;

    // save to storage
    await Promise.all([
      session && this.storage.set('session', session),
      user && this.storage.set('user', user),
    ].filter(Boolean));
  }

  /**
   * Performs token login with the provided session and handles token refresh if needed.
   *
   * @param session Current NavienSession containing access and refresh tokens
   * @param userId User ID to authenticate with
   * @param accountSeq Account sequence number for the user
   * @returns Response data from successful token login
   * @throws AuthException if authentication fails
   */
  private async _tokenLogin(
    session: NavienSession,
    userId: string,
    accountSeq: number,
    { onTokenRefreshed }: { onTokenRefreshed?: (session: NavienSession) => void },
  ) {
    // login with access token
    const response = await this.auth.tokenLogin(session.accessToken, userId, accountSeq)
      .catch(async (error) => {
        // access token is expired
        if (error instanceof AuthException) {
          this.log.warn('access token is expired. Refreshing token...');
          // refresh token
          const response = await this.auth.refreshToken(session.refreshToken);
          if (!response.data) {
            // saved refresh token has expired
            throw new ConfigurationException(
              'refreshToken',
              'refreshToken has expired. Please login again to get new one and update your config.json',
            );
          }

          // login with new access token
          const newSession = NavienSession.fromAuthInfo(response.data.authInfo, session.refreshToken);
          onTokenRefreshed?.(newSession);
          return this.auth.tokenLogin(newSession.accessToken, userId, accountSeq);
        }
        throw error;
      });
    assert(response.data, 'No data in token-login response.');

    return response.data;
  }
}
