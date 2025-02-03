import { API, Characteristic, DynamicPlatformPlugin, Logging, PlatformAccessory, PlatformConfig, Service } from 'homebridge';
import path from 'path';

import { HeatingMatFactory } from './homebridge/heating-mat.factory.js';
import { NavienException } from './navien/exceptions/index.js';
import { NavienApi } from './navien/navien.api.js';
import { NavienAuth } from './navien/navien.auth.js';
import { NavienDevice } from './navien/navien.device.js';
import { NavienService } from './navien/navien.service.js';
import { NavienSessionManager } from './navien/navien.session-manager.js';
import { PLATFORM_NAME, PLUGIN_NAME } from './settings.js';
import { Persist } from './utils/persist.util.js';

type NavienDeviceContext = { device: NavienDevice };
export type NavienPlatformAccessory = PlatformAccessory<NavienDeviceContext>;

export type DisplayName = {
  device: string;
  mainSwitch?: string;
  left?: string;
  right?: string;
};
export type NavienPlatformConfig = PlatformConfig & {
  authMode: 'account' | 'token';
  username: string;
  password?: string;
  refreshToken?: string;
  accountSeq?: number;
  accessoryType: 'HeaterCooler' | 'Thermostat';
  soundEnabled: boolean;
  separateControl: boolean;
  displayName?: DisplayName[];
};

/**
 * HomebridgePlatform
 * This class is the main constructor for your plugin, this is where you should
 * parse the user config and discover/register accessories with Homebridge.
 */
export class NavienHomebridgePlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service;
  public readonly Characteristic: typeof Characteristic;

  // this is used to track restored cached accessories
  public readonly accessories: Map<string, NavienPlatformAccessory> = new Map();
  public readonly discoveredCacheUUIDs: string[] = [];

  public readonly config: NavienPlatformConfig;
  public readonly navienService: NavienService;

  constructor(
    public readonly log: Logging,
    config: PlatformConfig,
    public readonly api: API,
  ) {
    this.Service = api.hap.Service;
    this.Characteristic = api.hap.Characteristic;

    this.log.info('Finished initializing platform:', config.platform);

    // Homebridge 1.8.0 introduced a `log.success` method that can be used to log success messages
    // For users that are on a version prior to 1.8.0, we need a 'polyfill' for this method
    if (!log.success) {
      log.success = log.info;
    }

    this.config = this.initializeConfig(config);

    // initialize navien services
    const auth = new NavienAuth(log);
    const sessionManager = new NavienSessionManager(log, auth, this._createPersist(), this.config);
    const httpApi = new NavienApi(log, sessionManager, this.config.soundEnabled);
    this.navienService = new NavienService(log, sessionManager, httpApi);

    this.api.on('didFinishLaunching', this.onLaunched.bind(this));
  }

  /**
   * Initialize the config
   */
  initializeConfig(config: PlatformConfig) {
    // migrate new config @1.8.0
    config.soundEnabled = config.soundEnabled ?? false;
    config.separateControl = config.separateControl ?? false;

    return config as NavienPlatformConfig;
  }

  /**
   * This function is invoked when homebridge restores cached accessories from disk at startup.
   * It should be used to set up event handlers for characteristics and update respective values.
   */
  configureAccessory(accessory: PlatformAccessory) {
    this.log.info('Loading accessory from cache:', accessory.displayName);

    // add the restored accessory to the accessories cache, so we can track if it has already been registered
    this.accessories.set(accessory.UUID, accessory as NavienPlatformAccessory);
  }

  /**
   * When this event is fired it means Homebridge has restored all cached accessories from disk.
   * Dynamic Platform plugins should only register new accessories after this event was fired,
   * in order to ensure they weren't added to homebridge already. This event can also be used
   * to start discovery of new accessories.
   */
  async onLaunched() {
    this.log.info('onLaunched called');

    // wait for the navien service to be ready
    try {
      await this.navienService.ready();
    } catch (error) {
      if (error instanceof NavienException) {
        this.log.error(error.toString());
        return;
      }
      this.log.error(
        'Navien API is not ready for unknown reason. If this error persists, please report it to the developer. error:',
        error,
      );
      return;
    }

    // run the method to discover / register your devices as accessories
    const devices = await this.navienService.getDevices();
    for (const device of devices) {
      this._registerDeviceAsAccessory(device);
    }

    // you can also deal with accessories from the cache which are no longer present by removing them from Homebridge
    // for example, if your plugin logs into a cloud account to retrieve a device list, and a user has previously removed a device
    // from this cloud account, then this device will no longer be present in the device list but will still be in the Homebridge cache
    for (const [uuid, accessory] of this.accessories) {
      if (!this.discoveredCacheUUIDs.includes(uuid)) {
        this.log.info('Removing existing accessory from cache:', accessory.displayName);
        this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
      }
    }
  }

  private _registerDeviceAsAccessory(device: NavienDevice) {
    // generate a unique id for the accessory this should be generated from
    // something globally unique, but constant, for example, the device serial
    // number or MAC address
    const uuid = this.api.hap.uuid.generate(device.id);

    // see if an accessory with the same uuid has already been registered and restored from
    // the cached devices we stored in the `configureAccessory` method above
    const existingAccessory = this.accessories.get(uuid);

    const isDoubleHeatingMat = device.isDouble && this.config.separateControl;

    if (existingAccessory) {
      const hasService = (serviceType: typeof Service) => existingAccessory.services.some((service) => service instanceof serviceType);
      if (
        (isDoubleHeatingMat !== hasService(this.Service.Switch)) ||
        (this.config.accessoryType === 'HeaterCooler' && !hasService(this.Service.HeaterCooler)) ||
        (this.config.accessoryType === 'Thermostat' && !hasService(this.Service.Thermostat))
      ) {
        this.log.info(
          'Cached accessory does not match current config. Removing existing accessory from cache:',
          existingAccessory.displayName,
        );
        this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [existingAccessory]);
        this.accessories.delete(uuid);

        return this._registerDeviceAsAccessory(device);
      }
      // the accessory already exists
      this.log.info('Restoring existing accessory from cache:', existingAccessory.displayName);

      // if you need to update the accessory.context then you should run `api.updatePlatformAccessories`. e.g.:
      existingAccessory.context.device = device;
      this.api.updatePlatformAccessories([existingAccessory]);

      // create the accessory handler for the restored accessory
      // this is imported from `platformAccessory.ts`
      HeatingMatFactory.create(this, existingAccessory);

      // it is possible to remove platform accessories at any time using `api.unregisterPlatformAccessories`, e.g.:
      // remove platform accessories when no longer present
      // this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [existingAccessory]);
      // this.log.info('Removing existing accessory from cache:', existingAccessory.displayName);
    } else {
      // the accessory does not yet exist, so we need to create it
      this.log.info('Adding new accessory:', device.name);

      // create a new accessory
      const accessory = new this.api.platformAccessory<NavienDeviceContext>(device.name, uuid);

      // store a copy of the device object in the `accessory.context`
      // the `context` property can be used to store any data about the accessory you may need
      accessory.context.device = device;

      // create the accessory handler for the newly create accessory
      // this is imported from `platformAccessory.ts`
      HeatingMatFactory.create(this, accessory);

      // link the accessory to your platform
      this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
    }

    // push into discoveredCacheUUIDs
    this.discoveredCacheUUIDs.push(uuid);
  }

  /**
   * Create a persist instance of the plugin
   * @param paths - The paths to the directory
   * @returns A persist instance
   */
  private _createPersist(...paths: string[]): Persist {
    const dir = path.join(this.api.user.storagePath(), PLUGIN_NAME, 'persist', ...paths);
    return new Persist(dir);
  }
}
