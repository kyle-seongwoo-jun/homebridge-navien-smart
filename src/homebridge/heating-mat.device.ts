import { CharacteristicValue, Service } from 'homebridge';

import { NavienDevice } from '../navien/navien.device.js';
import { NavienDeviceStatusRepository } from '../navien/navien.device-status.js';
import { NavienService } from '../navien/navien.service.js';
import { DisplayName, NavienHomebridgePlatform, NavienPlatformAccessory } from '../platform.js';

export abstract class HeatingMat {
  protected readonly accessoryType: 'HeaterCooler' | 'Thermostat';
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
   * Get power state of the device, or running state of the specified zone.
   * @param zone - left or right, `undefined` for device
   * @returns power is on or off, or running state of the specified zone
   */
  protected async getPower(zone?: 'left' | 'right'): Promise<CharacteristicValue> {
    this.service.requestRefreshingStatus(this.device);

    const { HAPStatus, HapStatusError } = this.platform.api.hap;
    const { isConnected, isPowerOn } = this.deviceStatus;

    if (!isConnected) {
      this.log.info(zone ?
        `[HB] Get Running: not responding, zone: ${zone}` :
        '[HB] Get Power: not responding',
      );
      throw new HapStatusError(HAPStatus.SERVICE_COMMUNICATION_FAILURE);
    }

    const state = zone ?
      isPowerOn && this.deviceStatus.isZoneEnabled(zone) :
      isPowerOn;
    this.log.debug(zone ?
      `[HB] Get Running: ${state ? 'ON' : 'OFF'}, zone: ${zone}` :
      `[HB] Get Power: ${state ? 'ON' : 'OFF'}`,
    );

    // boolean automatically converted to 0 | 1
    // Active.INACTIVE | Active.ACTIVE
    // TargetHeatingCoolingState.OFF | TargetHeatingCoolingState.HEAT
    // CurrentHeatingCoolingState.OFF | CurrentHeatingCoolingState.HEAT
    return state;
  }

  /**
   * Turn on or off the device.
   * @param value - true to turn on, false to turn off
   */
  protected async setPower(value: CharacteristicValue /* 0 | 1 | boolean */) {
    const isPowerOn = !!value;

    this.log.debug('[HB] Set Power:', isPowerOn ? 'ON' : 'OFF');
    await this.service.activate(this.device, isPowerOn);
  }

  // Only used for HeaterCooler Service
  protected async getHeaterState(zone?: 'left' | 'right'): Promise<CharacteristicValue> {
    this.service.requestRefreshingStatus(this.device);

    const { HAPStatus, HapStatusError } = this.platform.api.hap;
    const { isConnected, isPowerOn } = this.deviceStatus;

    if (!isConnected) {
      this.log.info(`[HB] Get Heater State: not responding, zone: ${zone ?? 'unified'}`);
      throw new HapStatusError(HAPStatus.SERVICE_COMMUNICATION_FAILURE);
    }

    const isEnabled = zone ? this.deviceStatus.isZoneEnabled(zone) : true;
    const isIdle = this.deviceStatus.isZoneIdle(zone);

    const [state, stateString] = this.getCurrentHeaterStateWithString(isPowerOn && isEnabled, isIdle);

    this.log.debug(`[HB] Get Heater State: ${stateString}, zone: ${zone ?? 'unified'}`);
    return state;
  }

  /**
   * Get current temperature of the specified zone.
   * If device is not supporting current temperature, it will return target temperature.
   * @param zone - left or right, `undefined` for unified control
   * @returns current temperature
   */
  protected async getCurrentTemperature(zone?: 'left' | 'right'): Promise<CharacteristicValue> {
    this.service.requestRefreshingStatus(this.device);

    const { HAPStatus, HapStatusError } = this.platform.api.hap;
    const { isConnected } = this.deviceStatus;

    if (!isConnected) {
      this.log.info(`[HB] Get Current Temperature: not responding, zone: ${zone ?? 'unified'}`);
      throw new HapStatusError(HAPStatus.SERVICE_COMMUNICATION_FAILURE);
    }

    const temperature = this.deviceStatus.getCurrentTemperature(zone);

    this.log.debug(`[HB] Get Current Temperature: ${temperature}, zone: ${zone ?? 'unified'}`);
    return temperature;
  }

  /**
   * Get target temperature of the specified zone.
   * @param zone - left or right, `undefined` for unified
   * @returns target temperature
   */
  protected async getTargetTemperature(zone?: 'left' | 'right'): Promise<CharacteristicValue> {
    this.service.requestRefreshingStatus(this.device);

    const { HAPStatus, HapStatusError } = this.platform.api.hap;
    const { isConnected } = this.deviceStatus;

    if (!isConnected) {
      this.log.info(`[HB] Get Target Temperature: not responding, zone: ${zone ?? 'unified'}`);
      throw new HapStatusError(HAPStatus.SERVICE_COMMUNICATION_FAILURE);
    }

    const temperature = this.deviceStatus.getTargetTemperature(zone);

    this.log.debug(`[HB] Get Target Temperature: ${temperature}, zone: ${zone ?? 'unified'}`);
    return temperature;
  }

  /**
   * Set target temperature of the specified zone.
   * @param value - target temperature
   * @param zone - left or right, `undefined` for unified
   */
  protected async setTargetTemperature(value: CharacteristicValue, zone?: 'left' | 'right') {
    const temperature = value as number;

    this.log.debug(`[HB] Set Target Temperature: ${temperature}, zone: ${zone ?? 'unified'}`);
    await this.service.setTemperature(this.device, temperature, zone);
  }

  // Only used for HeaterCooler Service
  private async getLocked(): Promise<CharacteristicValue> {
    this.service.requestRefreshingStatus(this.device);

    const { Characteristic } = this.platform;
    const { HAPStatus, HapStatusError } = this.platform.api.hap;
    const { isConnected, isLocked } = this.deviceStatus;

    if (!isConnected) {
      this.log.info('[HB] Get Locked: not responding');
      throw new HapStatusError(HAPStatus.SERVICE_COMMUNICATION_FAILURE);
    }

    this.log.debug('[HB] Get Locked:', isLocked);
    return isLocked ?
      Characteristic.LockPhysicalControls.CONTROL_LOCK_ENABLED :
      Characteristic.LockPhysicalControls.CONTROL_LOCK_DISABLED;
  }

  // Only used for HeaterCooler Service
  private async setLocked(value: CharacteristicValue /* 0 | 1 */) {
    const isLocked = !!value;

    this.log.debug('[HB] Set Locked:', isLocked);
    await this.service.lock(this.device, isLocked);
  }

  /**
   * Convert active and idle state to heater state.
   * @param isActive - true if the device is active
   * @param isIdle - true if the device is idle
   * @returns heater state and its string representation
   */
  protected getCurrentHeaterStateWithString(isActive: boolean, isIdle: boolean): [CharacteristicValue, string] {
    const { Characteristic } = this.platform;

    if (!isActive) {
      return [Characteristic.CurrentHeaterCoolerState.INACTIVE, 'INACTIVE'];
    }

    return isIdle ?
      [Characteristic.CurrentHeaterCoolerState.IDLE, 'IDLE'] :
      [Characteristic.CurrentHeaterCoolerState.HEATING, 'HEATING'];
  }
}
