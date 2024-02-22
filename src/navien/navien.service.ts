import { ConnectionState } from '@aws-amplify/pubsub';
import { Logger } from 'homebridge';

import { AwsPubSub } from '../aws/pubsub';
import { NavienHomebridgePlatform } from '../platform';
import { NavienException } from './exceptions';
import { Device } from './interfaces';
import { NavienApi } from './navien.api';
import { NavienAuth } from './navien.auth';
import { NavienDevice } from './navien.device';
import { NavienSessionManager } from './navien.session-manager';

export class NavienService {
  private readonly api: NavienApi;
  private readonly auth: NavienAuth;
  private readonly sessionManager: NavienSessionManager;
  private pubsub?: AwsPubSub;

  constructor(
    private readonly platform: NavienHomebridgePlatform,
    private readonly log: Logger,
  ) {
    this.auth = new NavienAuth(log);
    this.sessionManager = new NavienSessionManager(log, this.auth, platform.createPersist(), platform.config);
    this.api = new NavienApi(log, this.sessionManager);
  }

  public async ready() {
    this.log.info('Ready to use Navien API');

    // load session from storage or create new session
    await this.sessionManager.ready();

    // initialize aws pubsub
    const { user, awsSession } = this.sessionManager;
    const pubsub = this.pubsub = new AwsPubSub(user!.familySeq, awsSession!);
    pubsub.connectionStateChanges().subscribe(async (connectionState) => {
      this.log.info('[AWS PubSub] Connection state changed:', connectionState);

      // refresh aws session and reconnect if connection is disrupted
      if (connectionState === ConnectionState.ConnectionDisrupted) {
        this.log.info('[AWS PubSub] Refreshing AWS session and reconnecting...');
        try {
          const newSession = await this.sessionManager.refreshAwsSession();
          pubsub.setSession(newSession);
        } catch (error) {
          if (error instanceof NavienException) {
            this.log.error(`[AWS PubSub] ${error}`);
            return;
          }
          this.log.error('[AWS PubSub] Failed to refresh AWS session:', error);
        }
      }
    });
  }

  public async getDevices() {
    this.log.info('Getting devices from Navien API');

    // get devices from Navien API
    const jsonArray = await this.api.getDevices().catch((error) => {
      this.log.error('Error while getting devices from Navien API:', error);
      return [] as Device[];
    });

    // create devices from json
    const devices = jsonArray.map((json) => new NavienDevice(this.log, this.api, this.pubsub!, json));
    this.log.info('Devices:', devices.map((device) => device.name));

    // load current state from AWS
    devices.forEach((device) => {
      device.initialize().catch((error) => {
        this.log.error('Error while initializing device:', error);
      });
    });

    return devices;
  }

  public async activate(device: NavienDevice, isActive: boolean) {
    this.log.info('Setting active to', isActive, 'for device', device.name);

    const success = await device.activate(isActive).then(() => true).catch((error) => {
      if (error instanceof NavienException) {
        this.log.error(error.toString());
        return false;
      }
      this.log.error('Unknown error while setting active for device', device.name, ':', error);
      return false;
    });

    if (success) {
      this.log.info('Active set to', isActive, 'for device', device.name);
    } else {
      this.log.error('Failed to set active to', isActive, 'for device', device.name);
    }
  }

  public async setTemperature(device: NavienDevice, temperature: number) {
    this.log.info('Setting temperature to', temperature, 'for device', device.name);

    const success = await device.setTemperature(temperature).then(() => true).catch((error) => {
      if (error instanceof NavienException) {
        this.log.error(error.toString());
        return false;
      }
      this.log.error('Unknown error while setting temperature for device', device.name, ':', error);
      return false;
    });

    if (success) {
      this.log.info('Temperature set to', temperature, 'for device', device.name);
    } else {
      this.log.error('Failed to set temperature to', temperature, 'for device', device.name);
    }
  }

  public async lock(device: NavienDevice, isLocked: boolean) {
    this.log.info('Setting lock to', isLocked, 'for device', device.name);

    const success = await device.lock(isLocked).then(() => true).catch((error) => {
      if (error instanceof NavienException) {
        this.log.error(error.toString());
        return false;
      }
      this.log.error('Unknown error while setting lock for device', device.name, ':', error);
      return false;
    });

    if (success) {
      this.log.info('Lock set to', isLocked, 'for device', device.name);
    } else {
      this.log.error('Failed to set lock to', isLocked, 'for device', device.name);
    }
  }
}
