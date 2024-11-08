import { ConnectionState } from '@aws-amplify/pubsub';
import assert from 'assert';
import { Logger } from 'homebridge';

import { OperationMode } from '../aws/interfaces';
import { AwsPubSub } from '../aws/pubsub';
import { NavienException } from './exceptions';
import { Device } from './interfaces';
import { NavienApi } from './navien.api';
import { NavienDevice } from './navien.device';
import { NavienDeviceStatusRepository } from './navien.device-status';
import { NavienSessionManager } from './navien.session-manager';

export class NavienService {
  private pubsub?: AwsPubSub;
  private deviceStatusRepositories?: Record<string, NavienDeviceStatusRepository>;

  constructor(
    private readonly log: Logger,
    private readonly sessionManager: NavienSessionManager,
    private readonly api: NavienApi,
  ) { }

  public async ready() {
    this.log.info('Preparing Navien service...');

    // load session from storage or create new session
    await this.sessionManager.ready();

    // initialize aws pubsub
    const { user, awsSession } = this.sessionManager;
    const pubsub = this.pubsub = new AwsPubSub(user!.userSeq, user!.homeSeq, awsSession!);
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

    if (this.deviceStatusRepositories !== undefined) {
      this.log.info('Disposing old device status repositories...');
      Object.values(this.deviceStatusRepositories).forEach((repository) => repository.dispose());
      this.deviceStatusRepositories = undefined;
    }

    // get devices from Navien API
    const jsonArray = await this.api.getDevices().catch((error) => {
      this.log.error('Error while getting devices from Navien API:', error);
      return [] as Device[];
    });

    // create devices from json
    const devices = jsonArray.map((json) => new NavienDevice(json));
    this.deviceStatusRepositories = Object.fromEntries(
      devices.map((device) => [
        device.id,
        new NavienDeviceStatusRepository(this.log, this.pubsub!, device),
      ]),
    );
    this.log.info('Devices:', devices.map((device) => device.name));

    // load current state from AWS
    devices.forEach((device) => {
      this._initializeDevice(device).catch((error) => {
        this.log.error('Error while initializing device:', error);
      });
    });

    return devices;
  }

  public getDeviceStatusRepositoryOf(device: NavienDevice) {
    const repository = this.deviceStatusRepositories?.[device.id];
    assert(repository !== undefined, `Device status repository for "${device.name}" not found`);
    return repository;
  }

  private _initializeDevice(device: NavienDevice) {
    return this.api.initializeDevice(device);
  }

  private _activateDevice(device: NavienDevice, isActive: boolean) {
    return this.api.setOperationMode(device, isActive ? OperationMode.ON : OperationMode.OFF);
  }

  private _setTemperature(device: NavienDevice, temperature: number) {
    const { isDouble } = this.getDeviceStatusRepositoryOf(device)!;
    if (isDouble === null) {
      this.log.warn('device seems to be initialized or disconnected. but setTemperature is called', device.name);
      return Promise.resolve(); // do nothing
    }

    const temp = isDouble ? [temperature, temperature] as [number, number] : temperature;
    return this.api.setTemperature(device, temp, device.functions.heatRange);
  }

  private _lock(device: NavienDevice, isLocked: boolean) {
    return this.api.setChildLock(device, isLocked);
  }

  public async activate(device: NavienDevice, isActive: boolean) {
    this.log.info('Setting active to', isActive, 'for device', device.name);

    const success = await this._activateDevice(device, isActive).then(() => true).catch((error) => {
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

    const success = await this._setTemperature(device, temperature).then(() => true).catch((error) => {
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

    const success = await this._lock(device, isLocked).then(() => true).catch((error) => {
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
