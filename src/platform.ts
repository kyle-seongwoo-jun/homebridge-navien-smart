import { API, Characteristic, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service } from 'homebridge';
import path from 'path';

import ElectricMat from './homebridge/electric-mat.device';
import { AuthException, ConfigurationException } from './navien/exceptions';
import { NavienDevice } from './navien/navien.device';
import { NavienService } from './navien/navien.service';
import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { Persist } from './utils/persist.util';

type NavienDeviceContext = { device: NavienDevice };
export type NavienPlatformAccessory = PlatformAccessory<NavienDeviceContext>;
export type NavienPlatformConfig = PlatformConfig & {
  authMode: 'account' | 'token';
  username: string;
  password?: string;
  refreshToken?: string;
  accountSeq?: number;
  showCurrentTemperatureAsTarget: boolean;
};

/**
 * HomebridgePlatform
 * This class is the main constructor for your plugin, this is where you should
 * parse the user config and discover/register accessories with Homebridge.
 */
export class NavienHomebridgePlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;

  // this is used to track restored cached accessories
  public readonly accessories: NavienPlatformAccessory[] = [];

  public readonly config: NavienPlatformConfig;
  public readonly navienService: NavienService;

  constructor(
    public readonly log: Logger,
    config: PlatformConfig,
    public readonly api: API,
  ) {
    this.log.debug('Finished initializing platform:', config.platform);

    this.config = config as NavienPlatformConfig;
    this.navienService = new NavienService(this, log);

    this.api.on('didFinishLaunching', this.onLaunched);
  }

  /**
   * This function is invoked when homebridge restores cached accessories from disk at startup.
   * It should be used to setup event handlers for characteristics and update respective values.
   */
  configureAccessory(accessory: PlatformAccessory) {
    this.log.info('Loading accessory from cache:', accessory.displayName);

    // add the restored accessory to the accessories cache so we can track if it has already been registered
    this.accessories.push(accessory as NavienPlatformAccessory);
  }

  /**
   * When this event is fired it means Homebridge has restored all cached accessories from disk.
   * Dynamic Platform plugins should only register new accessories after this event was fired,
   * in order to ensure they weren't added to homebridge already. This event can also be used
   * to start discovery of new accessories.
   */
  onLaunched = async () => {
    this.log.debug('Executed didFinishLaunching callback');

    // wait for the navien service to be ready
    try {
      await this.navienService.ready();
    } catch (error) {
      if (error instanceof ConfigurationException) {
        this.log.error('ConfigurationException:', error.message);
        return;
      }
      if (error instanceof AuthException) {
        this.log.error('AuthException:', error.message);
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
      this.registerDeviceAsAccessory(device);
    }
  };

  registerDeviceAsAccessory(device: NavienDevice) {
    // generate a unique id for the accessory this should be generated from
    // something globally unique, but constant, for example, the device serial
    // number or MAC address
    const uuid = this.api.hap.uuid.generate(device.id);

    // see if an accessory with the same uuid has already been registered and restored from
    // the cached devices we stored in the `configureAccessory` method above
    const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid);

    if (existingAccessory) {
      // the accessory already exists
      this.log.info('Restoring existing accessory from cache:', existingAccessory.displayName);

      // if you need to update the accessory.context then you should run `api.updatePlatformAccessories`. eg.:
      existingAccessory.context.device = device;
      this.api.updatePlatformAccessories([existingAccessory]);

      // create the accessory handler for the restored accessory
      // this is imported from `platformAccessory.ts`
      new ElectricMat(this, existingAccessory);

      // it is possible to remove platform accessories at any time using `api.unregisterPlatformAccessories`, eg.:
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
      new ElectricMat(this, accessory);

      // link the accessory to your platform
      this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
    }
  }

  createPersist(...paths: string[]) {
    const dir = path.join(this.api.user.storagePath(), PLUGIN_NAME, 'persist', ...paths);
    return new Persist(dir);
  }
}
