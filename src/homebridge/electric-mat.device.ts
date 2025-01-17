import { CharacteristicValue, Service } from 'homebridge';

import { NavienDevice } from '../navien/navien.device.js';
import { NavienDeviceStatusRepository } from '../navien/navien.device-status.js';
import { NavienService } from '../navien/navien.service.js';
import { DisplayName, NavienHomebridgePlatform, NavienPlatformAccessory } from '../platform.js';

abstract class ElectricMat {
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
    this.displayName = displayName.find((item) => item.device === device.name);

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

export class ElectricMatSingle extends ElectricMat {
  private readonly heater?: Service;
  private readonly thermostat?: Service;

  constructor(
    protected readonly platform: NavienHomebridgePlatform,
    protected readonly accessory: NavienPlatformAccessory,
  ) {
    super(platform, accessory);

    // set heater or thermostat service
    switch (this.accessoryType) {
      case 'HeaterCooler':
        this.heater = this.initializeHeater();
        break;
      case 'Thermostat':
        this.thermostat = this.initializeThermostat();
        break;
      default:
        throw new Error(`Invalid accessory type: ${this.accessoryType}`);
    }
  }

  private initializeHeater(): Service {
    const {
      Characteristic: {
        Name,
        Active,
        CurrentHeaterCoolerState,
        CurrentTemperature,
        HeatingThresholdTemperature,
        LockPhysicalControls,
      },
      Service: {
        HeaterCooler,
      },
    } = this.platform;

    const heater = this.accessory.getService(HeaterCooler)
      || this.accessory.addService(HeaterCooler);

    // name
    heater.setCharacteristic(Name, this.device.name);
    this.initializeHeaterBase(heater);

    // active state
    heater.getCharacteristic(Active)
      .onGet(this.getActive.bind(this))
      .onSet(this.setActive.bind(this));

    // current state
    heater.getCharacteristic(CurrentHeaterCoolerState)
      .onGet(this.getHeaterState.bind(this));

    // current temperature
    heater.getCharacteristic(CurrentTemperature)
      .onGet(this.getTemperatureCurrent.bind(this));

    // target temperature
    heater.getCharacteristic(HeatingThresholdTemperature)
      .onGet(this.getTemperatureSet.bind(this))
      .onSet(this.setTemperatureSet.bind(this));

    const getCurrentHeaterState = (isPowerOn: boolean, isIdle: boolean) => {
      return isPowerOn ?
        isIdle ?
          CurrentHeaterCoolerState.IDLE :
          CurrentHeaterCoolerState.HEATING :
        CurrentHeaterCoolerState.INACTIVE;
    };

    // subscribe to device events
    this.deviceStatus.isPowerOnChanges.subscribe((isPowerOn: boolean) => {
      heater.updateCharacteristic(Active, isPowerOn ? Active.ACTIVE : Active.INACTIVE);
    });
    this.deviceStatus.temperatureCurrentChanges.subscribe((temperatureCurrent: number) => {
      const { isPowerOn, isIdle } = this.deviceStatus;
      heater.updateCharacteristic(CurrentTemperature, temperatureCurrent);
      // We may need to update CurrentHeaterCoolerState since isIdle may have changed
      heater.updateCharacteristic(CurrentHeaterCoolerState, getCurrentHeaterState(isPowerOn, isIdle));
    });
    this.deviceStatus.temperatureSetChanges.subscribe((temperatureSet: number) => {
      const { isPowerOn, isIdle } = this.deviceStatus;
      heater.updateCharacteristic(HeatingThresholdTemperature, temperatureSet);
      // We may need to update CurrentHeaterCoolerState since isIdle may have changed
      heater.updateCharacteristic(CurrentHeaterCoolerState, getCurrentHeaterState(isPowerOn, isIdle));
    });
    this.deviceStatus.lockedChanges.subscribe((isLocked: boolean) => {
      heater.updateCharacteristic(LockPhysicalControls, isLocked);
    });

    return heater;
  }

  private initializeThermostat(): Service {
    const {
      Characteristic: {
        Name,
        CurrentHeatingCoolingState,
        TargetHeatingCoolingState,
        CurrentTemperature,
        TargetTemperature,
      },
      Service: {
        Thermostat,
      },
    } = this.platform;

    const thermostat = this.accessory.getService(Thermostat)
      || this.accessory.addService(Thermostat);

    // name
    thermostat.setCharacteristic(Name, this.device.name);
    this.initializeThermostatBase(thermostat);

    // current state
    thermostat.getCharacteristic(CurrentHeatingCoolingState)
      .onGet(this.getHeatingState.bind(this));

    // target state
    thermostat.getCharacteristic(TargetHeatingCoolingState)
      .onGet(this.getHeatingState.bind(this))
      .onSet(this.setHeatingState.bind(this));

    // current temperature
    thermostat.getCharacteristic(CurrentTemperature)
      .onGet(this.getTemperatureCurrent.bind(this));

    // target temperature
    thermostat.getCharacteristic(TargetTemperature)
      .onGet(this.getTemperatureSet.bind(this))
      .onSet(this.setTemperatureSet.bind(this));

    // subscribe to device events
    this.deviceStatus.isPowerOnChanges.subscribe((isPowerOn: boolean) => {
      thermostat.updateCharacteristic(
        CurrentHeatingCoolingState,
        isPowerOn ? CurrentHeatingCoolingState.HEAT : CurrentHeatingCoolingState.OFF,
      );
      thermostat.updateCharacteristic(
        TargetHeatingCoolingState,
        isPowerOn ? TargetHeatingCoolingState.HEAT : TargetHeatingCoolingState.OFF,
      );
    });
    this.deviceStatus.temperatureCurrentChanges.subscribe((temperatureCurrent: number) => {
      thermostat.updateCharacteristic(CurrentTemperature, temperatureCurrent);
    });
    this.deviceStatus.temperatureSetChanges.subscribe((temperatureSet: number) => {
      thermostat.updateCharacteristic(TargetTemperature, temperatureSet);
    });

    return thermostat;
  }

  // Only used for HeaterCooler Service
  private async getActive(): Promise<CharacteristicValue> {
    const { Characteristic } = this.platform;
    const { HAPStatus, HapStatusError } = this.platform.api.hap;
    const { isConnected, isPowerOn } = this.deviceStatus;

    if (!isConnected) {
      this.log.info('Get Active: not responding');
      throw new HapStatusError(HAPStatus.SERVICE_COMMUNICATION_FAILURE);
    }

    this.log.debug('Get Active:', isPowerOn ? 'ACTIVE' : 'INACTIVE');

    return isPowerOn ? Characteristic.Active.ACTIVE : Characteristic.Active.INACTIVE;
  }

  // Only used for HeaterCooler Service
  private async setActive(value: CharacteristicValue) {
    const state = value as number;
    const isPowerOn = !!state;

    this.log.info('Set Active:', isPowerOn ? 'ACTIVE' : 'INACTIVE');

    await this.service.activate(this.device, isPowerOn);
  }

  // Only used for HeaterCooler Service
  private async getHeaterState(): Promise<CharacteristicValue> {
    const { Characteristic } = this.platform;
    const { HAPStatus, HapStatusError } = this.platform.api.hap;
    const { isConnected, isPowerOn, isIdle } = this.deviceStatus;

    if (!isConnected) {
      this.log.info('Get Heater State: not responding');
      throw new HapStatusError(HAPStatus.SERVICE_COMMUNICATION_FAILURE);
    }

    const state = (() => {
      if (!isPowerOn) {
        return [Characteristic.CurrentHeaterCoolerState.INACTIVE, 'INACTIVE'];
      }
      return isIdle ?
        [Characteristic.CurrentHeaterCoolerState.IDLE, 'IDLE'] :
        [Characteristic.CurrentHeaterCoolerState.HEATING, 'HEATING'];
    })();

    this.log.debug('Get Heater State:', state[1]);

    return state[0];
  }

  // Only used for Thermostat Service
  private async getHeatingState(): Promise<CharacteristicValue> {
    const { Characteristic } = this.platform;
    const { HAPStatus, HapStatusError } = this.platform.api.hap;
    const { isConnected, isPowerOn } = this.deviceStatus;

    if (!isConnected) {
      this.log.info('Get Heating State: not responding');
      throw new HapStatusError(HAPStatus.SERVICE_COMMUNICATION_FAILURE);
    }

    this.log.debug('Get Heating State:', isPowerOn ? 'HEAT' : 'OFF');

    return isPowerOn ? Characteristic.CurrentHeatingCoolingState.HEAT : Characteristic.CurrentHeatingCoolingState.OFF;
  }

  // Only used for Thermostat Service
  private async setHeatingState(value: CharacteristicValue) {
    const state = value as number;
    const isPowerOn = !!state;

    this.log.info('Set Heating State:', isPowerOn ? 'HEAT' : 'OFF');

    await this.service.activate(this.device, isPowerOn);
  }

  private async getTemperatureSet(): Promise<CharacteristicValue> {
    const { HAPStatus, HapStatusError } = this.platform.api.hap;
    const { isConnected, temperatureSet } = this.deviceStatus;

    if (!isConnected) {
      this.log.info('Get TemperatureSet: not responding');
      throw new HapStatusError(HAPStatus.SERVICE_COMMUNICATION_FAILURE);
    }

    this.log.debug('Get TemperatureSet:', temperatureSet);

    return temperatureSet;
  }

  private async setTemperatureSet(value: CharacteristicValue) {
    const temperature = value as number;

    this.log.info('Set TemperatureSet:', temperature);

    await this.service.setTemperature(this.device, temperature);
  }
}

export class ElectricMatDouble extends ElectricMat {
  private readonly mainSwitch: Service;
  private readonly heaterLeft?: Service;
  private readonly heaterRight?: Service;
  private readonly thermostatLeft?: Service;
  private readonly thermostatRight?: Service;

  constructor(
    protected readonly platform: NavienHomebridgePlatform,
    protected readonly accessory: NavienPlatformAccessory,
  ) {
    super(platform, accessory);

    // set main switch service
    this.mainSwitch = this.initializeMainSwitch();

    // set heater or thermostat service
    switch (this.accessoryType) {
      case 'HeaterCooler':
        [this.heaterLeft, this.heaterRight] = this.initializeHeater();
        break;
      case 'Thermostat':
        [this.thermostatLeft, this.thermostatRight] = this.initializeThermostat();
        break;
      default:
        throw new Error(`Invalid accessory type: ${this.accessoryType}`);
    }
  }

  private initializeMainSwitch(): Service {
    const {
      Characteristic: {
        ConfiguredName,
        On,
      },
      Service: {
        Switch,
      },
    } = this.platform;

    const mainSwitch = this.accessory.getService(Switch)
      || this.accessory.addService(Switch);

    // name
    const name = this.displayName?.mainSwitch || this.device.name + ' Switch';
    mainSwitch.addOptionalCharacteristic(ConfiguredName);
    mainSwitch.setCharacteristic(ConfiguredName, name);

    mainSwitch.getCharacteristic(On)
      .onGet(this.getPowerOn.bind(this))
      .onSet(this.setPowerOn.bind(this));

    // subscribe to device events
    this.deviceStatus.isPowerOnChanges.subscribe((isPowerOn: boolean) => {
      mainSwitch.updateCharacteristic(On, isPowerOn);
    });

    return mainSwitch;
  }

  private initializeHeater(): [Service, Service] {
    const {
      Characteristic: {
        ConfiguredName,
        Active,
        CurrentHeaterCoolerState,
        CurrentTemperature,
        HeatingThresholdTemperature,
        LockPhysicalControls,
      },
      Service: {
        HeaterCooler,
      },
    } = this.platform;

    const serviceNameLeft = this.device.name + ' LEFT';
    const serviceNameRight = this.device.name + ' RIGHT';
    const heaterLeft = this.accessory.getService(serviceNameLeft)
      || this.accessory.addService(HeaterCooler, serviceNameLeft, 'LEFT');
    const heaterRight = this.accessory.getService(serviceNameRight)
      || this.accessory.addService(HeaterCooler, serviceNameRight, 'RIGHT');

    // name
    const nameLeft = this.displayName?.left || this.device.name + ' Left';
    const nameRight = this.displayName?.right || this.device.name + ' Right';
    heaterLeft.addOptionalCharacteristic(ConfiguredName);
    heaterLeft.setCharacteristic(ConfiguredName, nameLeft);
    heaterRight.addOptionalCharacteristic(ConfiguredName);
    heaterRight.setCharacteristic(ConfiguredName, nameRight);

    this.initializeHeaterBase(heaterLeft);
    this.initializeHeaterBase(heaterRight);

    // active state
    heaterLeft.getCharacteristic(Active)
      .onGet(this.getRunningLeft.bind(this))
      .onSet(this.setRunningLeft.bind(this));
    heaterRight.getCharacteristic(Active)
      .onGet(this.getRunningRight.bind(this))
      .onSet(this.setRunningRight.bind(this));

    // current state
    heaterLeft.getCharacteristic(CurrentHeaterCoolerState)
      .onGet(this.getHeaterStateLeft.bind(this));
    heaterRight.getCharacteristic(CurrentHeaterCoolerState)
      .onGet(this.getHeaterStateRight.bind(this));

    // current temperature
    heaterLeft.getCharacteristic(CurrentTemperature)
      .onGet(this.getTemperatureCurrent.bind(this));
    heaterRight.getCharacteristic(CurrentTemperature)
      .onGet(this.getTemperatureCurrentRight.bind(this));

    // target temperature
    heaterLeft.getCharacteristic(HeatingThresholdTemperature)
      .onGet(this.getTemperatureSet.bind(this))
      .onSet(this.setTemperatureSet.bind(this));
    heaterRight.getCharacteristic(HeatingThresholdTemperature)
      .onGet(this.getTemperatureSetRight.bind(this))
      .onSet(this.setTemperatureSetRight.bind(this));

    const getCurrentHeaterState = (isZoneEnabled: boolean, isZoneIdle: boolean) => {
      return isZoneEnabled ?
        isZoneIdle ?
          CurrentHeaterCoolerState.IDLE :
          CurrentHeaterCoolerState.HEATING :
        CurrentHeaterCoolerState.INACTIVE;
    };

    // subscribe to device events
    this.deviceStatus.isPowerOnChanges.subscribe((isPowerOn: boolean) => {
      const { isLeftEnabled, isRightEnabled, isIdle, isRightIdle } = this.deviceStatus;
      const isLeftRunning = isPowerOn && isLeftEnabled;
      const isRightRunning = isPowerOn && isRightEnabled;

      heaterLeft.updateCharacteristic(Active, isLeftRunning ? Active.ACTIVE : Active.INACTIVE);
      heaterRight.updateCharacteristic(Active, isRightRunning ? Active.ACTIVE : Active.INACTIVE);
      heaterLeft.updateCharacteristic(CurrentHeaterCoolerState, getCurrentHeaterState(isLeftRunning, isIdle));
      heaterRight.updateCharacteristic(CurrentHeaterCoolerState, getCurrentHeaterState(isRightRunning, isRightIdle));
    });

    this.deviceStatus.isLeftEnabledChanges.subscribe((isLeftEnabled: boolean) => {
      const { isPowerOn, isIdle } = this.deviceStatus;
      const isLeftRunning = isPowerOn && isLeftEnabled;

      heaterLeft.updateCharacteristic(Active, isLeftRunning ? Active.ACTIVE : Active.INACTIVE);
      heaterLeft.updateCharacteristic(CurrentHeaterCoolerState, getCurrentHeaterState(isLeftRunning, isIdle));
    });
    this.deviceStatus.isRightEnabledChanges.subscribe((isRightEnabled: boolean) => {
      const { isPowerOn, isRightIdle } = this.deviceStatus;
      const isRightRunning = isPowerOn && isRightEnabled;

      heaterRight.updateCharacteristic(Active, isRightRunning ? Active.ACTIVE : Active.INACTIVE);
      heaterRight.updateCharacteristic(CurrentHeaterCoolerState, getCurrentHeaterState(isRightRunning, isRightIdle));
    });

    this.deviceStatus.temperatureCurrentChanges.subscribe((temperatureCurrent: number) => {
      const { isPowerOn, isLeftEnabled, isIdle } = this.deviceStatus;

      heaterLeft.updateCharacteristic(CurrentTemperature, temperatureCurrent);
      heaterLeft.updateCharacteristic(CurrentHeaterCoolerState, getCurrentHeaterState(isPowerOn && isLeftEnabled, isIdle));
    });
    this.deviceStatus.temperatureCurrentRightChanges.subscribe((temperatureRightCurrent: number) => {
      const { isPowerOn, isRightEnabled, isRightIdle } = this.deviceStatus;

      heaterRight.updateCharacteristic(CurrentTemperature, temperatureRightCurrent);
      heaterRight.updateCharacteristic(CurrentHeaterCoolerState, getCurrentHeaterState(isPowerOn && isRightEnabled, isRightIdle));
    });

    this.deviceStatus.temperatureSetChanges.subscribe((temperatureSet: number) => {
      const { isPowerOn, isLeftEnabled, isIdle } = this.deviceStatus;

      heaterLeft.updateCharacteristic(HeatingThresholdTemperature, temperatureSet);
      // We may need to update CurrentHeaterCoolerState since isIdle may have changed
      heaterLeft.updateCharacteristic(CurrentHeaterCoolerState, getCurrentHeaterState(isPowerOn && isLeftEnabled, isIdle));
    });
    this.deviceStatus.temperatureSetRightChanges.subscribe((temperatureRightSet: number) => {
      const { isPowerOn, isRightEnabled, isRightIdle } = this.deviceStatus;

      heaterRight.updateCharacteristic(HeatingThresholdTemperature, temperatureRightSet);
      // We may need to update CurrentHeaterCoolerState since isRightIdle may have changed
      heaterRight.updateCharacteristic(CurrentHeaterCoolerState, getCurrentHeaterState(isPowerOn && isRightEnabled, isRightIdle));
    });

    this.deviceStatus.lockedChanges.subscribe((isLocked: boolean) => {
      heaterLeft.updateCharacteristic(LockPhysicalControls, isLocked);
      heaterRight.updateCharacteristic(LockPhysicalControls, isLocked);
    });

    return [heaterLeft, heaterRight];
  }

  private initializeThermostat(): [Service, Service] {
    const {
      Characteristic: {
        ConfiguredName,
        CurrentHeatingCoolingState,
        TargetHeatingCoolingState,
        CurrentTemperature,
        TargetTemperature,
      },
      Service: {
        Thermostat,
      },
    } = this.platform;
    const serviceNameLeft = this.device.name + ' Left';
    const serviceNameRight = this.device.name + ' Right';
    const thermostatLeft = this.accessory.getService(serviceNameLeft)
      || this.accessory.addService(Thermostat, serviceNameLeft, 'LEFT');
    const thermostatRight = this.accessory.getService(serviceNameRight)
      || this.accessory.addService(Thermostat, serviceNameRight, 'RIGHT');

    // name
    const nameLeft = this.displayName?.left || this.device.name + ' Left';
    const nameRight = this.displayName?.right || this.device.name + ' Right';
    thermostatLeft.addOptionalCharacteristic(ConfiguredName);
    thermostatLeft.setCharacteristic(ConfiguredName, nameLeft);
    thermostatRight.addOptionalCharacteristic(ConfiguredName);
    thermostatRight.setCharacteristic(ConfiguredName, nameRight);

    this.initializeThermostatBase(thermostatLeft);
    this.initializeThermostatBase(thermostatRight);

    // current state
    thermostatLeft.getCharacteristic(CurrentHeatingCoolingState)
      .onGet(this.getRunningLeft.bind(this));
    thermostatRight.getCharacteristic(CurrentHeatingCoolingState)
      .onGet(this.getRunningRight.bind(this));

    // target state
    thermostatLeft.getCharacteristic(TargetHeatingCoolingState)
      .onGet(this.getRunningLeft.bind(this))
      .onSet(this.setRunningLeft.bind(this));
    thermostatRight.getCharacteristic(TargetHeatingCoolingState)
      .onGet(this.getRunningRight.bind(this))
      .onSet(this.setRunningRight.bind(this));

    //current temperature
    thermostatLeft.getCharacteristic(CurrentTemperature)
      .onGet(this.getTemperatureCurrent.bind(this));
    thermostatRight.getCharacteristic(CurrentTemperature)
      .onGet(this.getTemperatureCurrentRight.bind(this));

    // target temperature
    thermostatLeft.getCharacteristic(TargetTemperature)
      .onGet(this.getTemperatureSet.bind(this))
      .onSet(this.setTemperatureSet.bind(this));
    thermostatRight.getCharacteristic(TargetTemperature)
      .onGet(this.getTemperatureSetRight.bind(this))
      .onSet(this.setTemperatureSetRight.bind(this));

    // subscribe to device events
    this.deviceStatus.isPowerOnChanges.subscribe((isPowerOn: boolean) => {
      const { isLeftEnabled, isRightEnabled } = this.deviceStatus;

      thermostatLeft.updateCharacteristic(
        CurrentHeatingCoolingState,
        isPowerOn && isLeftEnabled ? CurrentHeatingCoolingState.HEAT : CurrentHeatingCoolingState.OFF,
      );
      thermostatLeft.updateCharacteristic(
        TargetHeatingCoolingState,
        isPowerOn && isLeftEnabled ? TargetHeatingCoolingState.HEAT : TargetHeatingCoolingState.OFF,
      );
      thermostatRight.updateCharacteristic(
        CurrentHeatingCoolingState,
        isPowerOn && isRightEnabled ? CurrentHeatingCoolingState.HEAT : CurrentHeatingCoolingState.OFF,
      );
      thermostatRight.updateCharacteristic(
        TargetHeatingCoolingState,
        isPowerOn && isRightEnabled ? TargetHeatingCoolingState.HEAT : TargetHeatingCoolingState.OFF,
      );
    });

    this.deviceStatus.isLeftEnabledChanges.subscribe((isLeftEnabled: boolean) => {
      const { isPowerOn } = this.deviceStatus;
      const isLeftRunning = isPowerOn && isLeftEnabled;

      thermostatLeft.updateCharacteristic(
        CurrentHeatingCoolingState,
        isLeftRunning ? CurrentHeatingCoolingState.HEAT : CurrentHeatingCoolingState.OFF,
      );
      thermostatLeft.updateCharacteristic(
        TargetHeatingCoolingState,
        isLeftRunning ? TargetHeatingCoolingState.HEAT : TargetHeatingCoolingState.OFF,
      );
    });
    this.deviceStatus.isRightEnabledChanges.subscribe((isRightEnabled: boolean) => {
      const { isPowerOn } = this.deviceStatus;
      const isRightRunning = isPowerOn && isRightEnabled;

      thermostatRight.updateCharacteristic(
        CurrentHeatingCoolingState,
        isRightRunning ? CurrentHeatingCoolingState.HEAT : CurrentHeatingCoolingState.OFF,
      );
      thermostatRight.updateCharacteristic(
        TargetHeatingCoolingState,
        isRightRunning ? TargetHeatingCoolingState.HEAT : TargetHeatingCoolingState.OFF,
      );
    });

    this.deviceStatus.temperatureCurrentChanges.subscribe((temperatureCurrent: number) => {
      thermostatLeft.updateCharacteristic(CurrentTemperature, temperatureCurrent);
    });
    this.deviceStatus.temperatureCurrentRightChanges.subscribe((temperatureCurrentRight: number) => {
      thermostatRight.updateCharacteristic(CurrentTemperature, temperatureCurrentRight);
    });

    this.deviceStatus.temperatureSetChanges.subscribe((temperatureSet: number) => {
      thermostatLeft.updateCharacteristic(TargetTemperature, temperatureSet);
    });
    this.deviceStatus.temperatureSetRightChanges.subscribe((temperatureSetRight: number) => {
      thermostatRight.updateCharacteristic(TargetTemperature, temperatureSetRight);
    });

    return [thermostatLeft, thermostatRight];
  }

  private async getPowerOn(): Promise<CharacteristicValue> {
    const { HAPStatus, HapStatusError } = this.platform.api.hap;
    const { isConnected, isPowerOn } = this.deviceStatus;

    if (!isConnected) {
      this.log.info('Get PowerOn: not responding');
      throw new HapStatusError(HAPStatus.SERVICE_COMMUNICATION_FAILURE);
    }

    this.log.debug('Get PowerOn:', isPowerOn ? 'ON' : 'OFF');

    return isPowerOn;
  }

  private async setPowerOn(value: CharacteristicValue) {
    const state = value as number;
    const isPowerOn = !!state;

    this.log.info('Set PowerOn:', isPowerOn ? 'ON' : 'OFF');

    await this.service.activate(this.device, isPowerOn);
  }

  private async getRunningLeft(): Promise<CharacteristicValue> {
    const { Characteristic } = this.platform;
    const { HAPStatus, HapStatusError } = this.platform.api.hap;
    const { isConnected, isPowerOn, isLeftEnabled } = this.deviceStatus;

    if (!isConnected) {
      this.log.info('Get Left Running: not responding');
      throw new HapStatusError(HAPStatus.SERVICE_COMMUNICATION_FAILURE);
    }

    switch (this.accessoryType) {
      case 'HeaterCooler':
        return isPowerOn && isLeftEnabled ?
          Characteristic.Active.ACTIVE :
          Characteristic.Active.INACTIVE;
      case 'Thermostat':
        return isPowerOn && isLeftEnabled ?
          Characteristic.CurrentHeatingCoolingState.HEAT :
          Characteristic.CurrentHeatingCoolingState.OFF;
      default:
        throw new Error(`Invalid accessory type: ${this.accessoryType}`);
    }
  }

  private async setRunningLeft(value: CharacteristicValue) {
    const state = value as number;
    const isEnable = !!state;
    const { heatRange } = this.device.functions;
    const { isPowerOn, isLeftEnabled, isRightEnabled } = this.deviceStatus;
    const {
      Characteristic: {
        TargetTemperature,
      },
    } = this.platform;

    this.log.info('Set Left Running:', isEnable ? 'ON' : 'OFF');

    if (isEnable && !isPowerOn && isLeftEnabled) {
      await this.service.activate(this.device, true);
    } else if (!isEnable && isPowerOn && !isRightEnabled) {
      // If it tries to disable left zone while right zone is already disabled, just turn off the device
      await this.service.activate(this.device, false);
    } else {
      // We can simply enable/disable the zone by setting the target temperature
      const temperature = isEnable ? heatRange.min + heatRange.step : heatRange.min;
      this.thermostatLeft?.updateCharacteristic(TargetTemperature, temperature);
      await this.service.setZoneTemperature(this.device, 'left', temperature);
    }
  }

  private async getRunningRight(): Promise<CharacteristicValue> {
    const { Characteristic } = this.platform;
    const { HAPStatus, HapStatusError } = this.platform.api.hap;
    const { isConnected, isPowerOn, isRightEnabled } = this.deviceStatus;

    if (!isConnected) {
      this.log.info('Get Right Running: not responding');
      throw new HapStatusError(HAPStatus.SERVICE_COMMUNICATION_FAILURE);
    }

    switch (this.accessoryType) {
      case 'HeaterCooler':
        return isPowerOn && isRightEnabled ?
          Characteristic.Active.ACTIVE :
          Characteristic.Active.INACTIVE;
      case 'Thermostat':
        return isPowerOn && isRightEnabled ?
          Characteristic.CurrentHeatingCoolingState.HEAT :
          Characteristic.CurrentHeatingCoolingState.OFF;
      default:
        throw new Error(`Invalid accessory type: ${this.accessoryType}`);
    }
  }

  private async setRunningRight(value: CharacteristicValue) {
    const state = value as number;
    const isEnable = !!state;
    const { heatRange } = this.device.functions;
    const { isPowerOn, isLeftEnabled, isRightEnabled } = this.deviceStatus;
    const {
      Characteristic: {
        TargetTemperature,
      },
    } = this.platform;

    this.log.info('Set Right Running:', isEnable ? 'ON' : 'OFF');

    if (isEnable && !isPowerOn && isRightEnabled) {
      await this.service.activate(this.device, true);
    } else if (!isEnable && isPowerOn && !isLeftEnabled) {
      // If it tries to disable right zone while left zone is already disabled, just turn off the device
      await this.service.activate(this.device, false);
    } else {
      // We can simply enable/disable the zone by setting the target temperature
      const temperature = isEnable ? heatRange.min + heatRange.step : heatRange.min;
      this.thermostatRight?.updateCharacteristic(TargetTemperature, temperature);
      await this.service.setZoneTemperature(this.device, 'right', temperature);
    }
  }

  // Only used for HeaterCooler Service
  private async getHeaterStateLeft(): Promise<CharacteristicValue> {
    const { Characteristic } = this.platform;
    const { HAPStatus, HapStatusError } = this.platform.api.hap;
    const { isConnected, isPowerOn, isLeftEnabled, isIdle } = this.deviceStatus;

    if (!isConnected) {
      this.log.info('Get Left Heater State: not responding');
      throw new HapStatusError(HAPStatus.SERVICE_COMMUNICATION_FAILURE);
    }

    const state = isPowerOn && isLeftEnabled ?
      isIdle ?
        [Characteristic.CurrentHeaterCoolerState.IDLE, 'IDLE'] :
        [Characteristic.CurrentHeaterCoolerState.HEATING, 'HEATING'] :
      [Characteristic.CurrentHeaterCoolerState.INACTIVE, 'INACTIVE'];

    this.log.debug('Get Left Heater State:', state[1]);

    return state[0];
  }

  // Only used for HeaterCooler Service
  private async getHeaterStateRight(): Promise<CharacteristicValue> {
    const { Characteristic } = this.platform;
    const { HAPStatus, HapStatusError } = this.platform.api.hap;
    const { isConnected, isPowerOn, isRightEnabled, isRightIdle } = this.deviceStatus;

    if (!isConnected) {
      this.log.info('Get Right Heater State: not responding');
      throw new HapStatusError(HAPStatus.SERVICE_COMMUNICATION_FAILURE);
    }

    const state = isPowerOn && isRightEnabled ?
      isRightIdle ?
        [Characteristic.CurrentHeaterCoolerState.IDLE, 'IDLE'] :
        [Characteristic.CurrentHeaterCoolerState.HEATING, 'HEATING'] :
      [Characteristic.CurrentHeaterCoolerState.INACTIVE, 'INACTIVE'];

    this.log.debug('Get Right Heater State:', state[1]);

    return state[0];
  }

  private async getTemperatureSet(): Promise<CharacteristicValue> {
    const { HAPStatus, HapStatusError } = this.platform.api.hap;
    const { isConnected, temperatureSet } = this.deviceStatus;

    if (!isConnected) {
      this.log.info('Get TemperatureSet: not responding');
      throw new HapStatusError(HAPStatus.SERVICE_COMMUNICATION_FAILURE);
    }

    this.log.debug('Get TemperatureSet:', temperatureSet);

    return temperatureSet;
  }

  private async setTemperatureSet(value: CharacteristicValue) {
    const temperature = value as number;

    this.log.info('Set TemperatureSet:', temperature);

    await this.service.setZoneTemperature(this.device, 'left', temperature);
  }

  private async getTemperatureSetRight(): Promise<CharacteristicValue> {
    const { HAPStatus, HapStatusError } = this.platform.api.hap;
    const { isConnected, temperatureSetRight } = this.deviceStatus;

    if (!isConnected) {
      this.log.info('Get TemperatureSetRight: not responding');
      throw new HapStatusError(HAPStatus.SERVICE_COMMUNICATION_FAILURE);
    }

    this.log.debug('Get TemperatureSetRight:', temperatureSetRight);

    return temperatureSetRight;
  }

  private async setTemperatureSetRight(value: CharacteristicValue) {
    const temperature = value as number;

    this.log.info('Set TemperatureSetRight:', temperature);

    await this.service.setZoneTemperature(this.device, 'right', temperature);
  }
}
