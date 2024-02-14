import { Logger } from 'homebridge';

import { AwsPubSub } from '../aws/pubsub';
import { NavienHomebridgePlatform, NavienPlatformConfig } from '../platform';
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

    const devices = await this.api.getDevices().catch((error) => {
      this.log.error('Error while getting devices from Navien API:', error);
      return [] as Device[];
    });
    this.log.debug('Devices:', devices.map((device) => device.Properties.nickName.mainItem));

    for (const device of devices) {
      this.pubsub!.deviceStatusChanges(device.deviceId).subscribe((event) => {
        this.log.debug('Device event:', event);
      });
    }

    return devices;
  }

  public async setPower(device: Device, power: boolean) {
    this.log.debug('Setting power to', power, 'for device', device.Properties.nickName.mainItem);

    const success = await this.api.setPower(device, power).catch((error) => {
      this.log.error('Error while setting power for device', device.Properties.nickName.mainItem, ':', error);
      return false;
    });

    if (success) {
      this.log.debug('Power set to', power, 'for device', device.Properties.nickName.mainItem);
    } else {
      this.log.error('Failed to set power to', power, 'for device', device.Properties.nickName.mainItem);
    }
  }

  public async setTemperature(device: Device, temperature: number) {
    this.log.debug('Setting temperature to', temperature, 'for device', device.Properties.nickName.mainItem);

    const success = await this.api.setTemperature(device, temperature).catch((error) => {
      this.log.error('Error while setting temperature for device', device.Properties.nickName.mainItem, ':', error);
      return false;
    });

    if (success) {
      this.log.debug('Temperature set to', temperature, 'for device', device.Properties.nickName.mainItem);
    } else {
      this.log.error('Failed to set temperature to', temperature, 'for device', device.Properties.nickName.mainItem);
    }
  }
}
