import { Logger } from 'homebridge';

import { AwsPubSub } from '../aws/pubsub';
import { NavienHomebridgePlatform, NavienPlatformConfig } from '../platform';
import { ApiException } from './exceptions';
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
    private readonly config: NavienPlatformConfig,
  ) {
    this.auth = new NavienAuth(log);
    this.sessionManager = new NavienSessionManager(log, this.auth, platform.createPersist(), config);
    this.api = new NavienApi(log, this.sessionManager);
  }

  public async ready() {
    this.log.debug('Ready to use Navien API');

    // load session from storage or create new session
    await this.sessionManager.ready();

    // initialize aws pubsub
    const { user, awsSession } = this.sessionManager;
    this.pubsub = new AwsPubSub(user!.familySeq, awsSession!);
    this.pubsub.connectionStateChanges().subscribe((connectionState) => {
      this.log.debug('Connection state changed:', connectionState);
    });
  }

  public async getDevices() {
    this.log.debug('Getting devices from Navien API');

    // get devices from Navien API
    const jsonArray = await this.api.getDevices().catch((error) => {
      this.log.error('Error while getting devices from Navien API:', error);
      return [] as Device[];
    });

    // create devices from json
    const devices = jsonArray.map((json) => new NavienDevice(this.log, this.api, this.pubsub!, json));
    this.log.debug('Devices:', devices.map((device) => device.name));

    // load current state from AWS
    devices.forEach((device) => {
      device.initialize().catch((error) => {
        this.log.error('Error while initializing device:', error);
      });
    });

    return devices;
  }

  public async setPower(device: NavienDevice, power: boolean) {
    this.log.debug('Setting power to', power, 'for device', device.name);

    const success = await device.setPower(power).then(() => true).catch((error) => {
      if (error instanceof ApiException) {
        this.log.error('APIException:', error.message);
        return false;
      }
      this.log.error('Unknown error while setting power for device', device.name, ':', error);
      return false;
    });

    if (success) {
      this.log.debug('Power set to', power, 'for device', device.name);
    } else {
      this.log.error('Failed to set power to', power, 'for device', device.name);
    }
  }

  public async setTemperature(device: NavienDevice, temperature: number) {
    this.log.debug('Setting temperature to', temperature, 'for device', device.name);

    const success = await device.setTemperature(temperature).then(() => true).catch((error) => {
      if (error instanceof ApiException) {
        this.log.error('APIException:', error.message);
        return false;
      }
      this.log.error('Unknown error while setting temperature for device', device.name, ':', error);
      return false;
    });

    if (success) {
      this.log.debug('Temperature set to', temperature, 'for device', device.name);
    } else {
      this.log.error('Failed to set temperature to', temperature, 'for device', device.name);
    }
  }
}
