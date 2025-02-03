import { CharacteristicValue, Service } from 'homebridge';

import { NavienDevice } from '../navien/navien.device.js';
import { NavienDeviceStatusRepository } from '../navien/navien.device-status.js';
import { NavienService } from '../navien/navien.service.js';
import { DisplayName, NavienHomebridgePlatform, NavienPlatformAccessory } from '../platform.js';

export abstract class HeatingMat {
  protected readonly accessoryType: string;
  protected readonly service: NavienService;
  protected readonly device: NavienDevice;
  protected readonly deviceStatus: NavienDeviceStatusRepository;
  protected readonly displayName?: DisplayName;

  constructor(
    protected readonly platform: NavienHomebridgePlatform,
    protected readonly accessory: NavienPlatformAccessory,
  ) {
    const {
      Characteristic,
      Service,
      navienService,
      config: {
        accessoryType,
        displayName,
      },
    } = this.platform;
    this.accessoryType = accessoryType;
    this.service = navienService;

    const { device } = accessory.context;
    this.device = device;
    this.deviceStatus = this.service.getDeviceStatusRepositoryOf(device)!;
    this.displayName = displayName?.find((item) => item.device === device.name);

    // set accessory information
    this.accessory.getService(Service.AccessoryInformation)!
      .setCharacteristic(Characteristic.Manufacturer, 'Navien')
      .setCharacteristic(Characteristic.Model, device.modelName)
      .setCharacteristic(Characteristic.SerialNumber, device.id);
  }

  protected get log() {
    return this.platform.log;
  }

  /**
   * Initialize HeaterCooler service characteristics both required for Single and Double
   * @param heater HeaterCooler service to initialize
   */
  protected initializeHeaterBase(heater: Service) {
    const {
      Characteristic: {
        TemperatureDisplayUnits,
        TargetHeaterCoolerState,
        HeatingThresholdTemperature,
        LockPhysicalControls,
      },
    } = this.platform;

    // temp unit
    heater.getCharacteristic(TemperatureDisplayUnits)
      .setProps({
        validValues: [TemperatureDisplayUnits.CELSIUS],
      })
      .setValue(TemperatureDisplayUnits.CELSIUS);

    // target state
    heater.getCharacteristic(TargetHeaterCoolerState)
      .setProps({
        validValues: [TargetHeaterCoolerState.HEAT],
      })
      .setValue(TargetHeaterCoolerState.HEAT);

    // heat range
    const { heatRange } = this.device.functions;
    heater.getCharacteristic(HeatingThresholdTemperature)
      .setProps({
        minValue: heatRange.min,
        maxValue: heatRange.max,
        minStep: heatRange.step,
      });

    // lock
    heater.getCharacteristic(LockPhysicalControls)
      .onGet(this.getLocked.bind(this))
      .onSet(this.setLocked.bind(this));
  }

  /**
   * Initialize Thermostat service characteristics both required for Single and Double
   * @param thermostat Thermostat service to initialize
   */
  protected initializeThermostatBase(thermostat: Service) {
    const {
      Characteristic: {
        TemperatureDisplayUnits,
        CurrentHeatingCoolingState,
        TargetHeatingCoolingState,
        TargetTemperature,
      },
    } = this.platform;

    // temp unit
    thermostat.getCharacteristic(TemperatureDisplayUnits)
      .setProps({
        validValues: [TemperatureDisplayUnits.CELSIUS],
      })
      .setValue(TemperatureDisplayUnits.CELSIUS);

    // current state
    thermostat.getCharacteristic(CurrentHeatingCoolingState)
      .setProps({
        validValues: [
          CurrentHeatingCoolingState.OFF,
          CurrentHeatingCoolingState.HEAT,
        ],
      });

    // target state
    thermostat.getCharacteristic(TargetHeatingCoolingState)
      .setProps({
        validValues: [
          TargetHeatingCoolingState.OFF,
          TargetHeatingCoolingState.HEAT,
        ],
      });

    // target temperature
    const { heatRange } = this.device.functions;
    thermostat.getCharacteristic(TargetTemperature)
      .setProps({
        minValue: heatRange.min,
        maxValue: heatRange.max,
        minStep: heatRange.step,
      });
  }

  /**
   * Get current temperature.
   * For Single, it returns the current temperature of the device.
   * For Double, it returns the current temperature of the left side.
   * @returns current temperature
   */
  protected async getTemperatureCurrent(): Promise<CharacteristicValue> {
    const { HAPStatus, HapStatusError } = this.platform.api.hap;
    const { isConnected, temperatureCurrent } = this.deviceStatus;

    if (!isConnected) {
      this.log.info('Get TemperatureCurrent: not responding');
      throw new HapStatusError(HAPStatus.SERVICE_COMMUNICATION_FAILURE);
    }

    this.log.debug('Get TemperatureCurrent:', temperatureCurrent);

    return temperatureCurrent;
  }

  /**
   * Get current temperature.
   * Only used for Double, it returns the current temperature of the right side.
   * @returns current temperature of the right side
   */
  protected async getTemperatureCurrentRight(): Promise<CharacteristicValue> {
    const { HAPStatus, HapStatusError } = this.platform.api.hap;
    const { isConnected, temperatureCurrentRight } = this.deviceStatus;

    if (!isConnected) {
      this.log.info('Get TemperatureCurrentRight: not responding');
      throw new HapStatusError(HAPStatus.SERVICE_COMMUNICATION_FAILURE);
    }

    this.log.debug('Get TemperatureCurrentRight:', temperatureCurrentRight);

    return temperatureCurrentRight;
  }

  // Only used for HeaterCooler Service
  private async getLocked(): Promise<CharacteristicValue> {
    const { HAPStatus, HapStatusError } = this.platform.api.hap;
    const { isConnected, isLocked } = this.deviceStatus;

    if (!isConnected) {
      this.log.info('Get Locked: not responding');
      throw new HapStatusError(HAPStatus.SERVICE_COMMUNICATION_FAILURE);
    }

    this.log.debug('Get Locked:', isLocked);

    return isLocked;
  }

  // Only used for HeaterCooler Service
  private async setLocked(value: CharacteristicValue) {
    const isLocked = !!value;

    this.log.info('Set Locked:', isLocked);

    await this.service.lock(this.device, isLocked);
  }
}
