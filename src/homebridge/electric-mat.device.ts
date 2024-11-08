import { CharacteristicValue, Service } from 'homebridge';

import { NavienDevice } from '../navien/navien.device';
import { NavienDeviceStatusRepository } from '../navien/navien.device-status';
import { NavienService } from '../navien/navien.service';
import { NavienHomebridgePlatform, NavienPlatformAccessory } from '../platform';

export default class ElectricMat {
  private readonly heater?: Service;
  private readonly thermostat?: Service;
  private readonly service: NavienService;
  private readonly device: NavienDevice;
  private readonly deviceStatus: NavienDeviceStatusRepository;

  constructor(
    private readonly platform: NavienHomebridgePlatform,
    private readonly accessory: NavienPlatformAccessory,
  ) {
    const {
      Characteristic,
      Service,
      navienService,
      config: {
        accessoryType,
      },
    } = this.platform;

    this.service = navienService;

    const { device } = accessory.context;
    this.device = device;
    this.deviceStatus = this.service.getDeviceStatusRepositoryOf(device)!;

    // set accessory information
    this.accessory.getService(Service.AccessoryInformation)!
      .setCharacteristic(Characteristic.Manufacturer, 'Navien')
      .setCharacteristic(Characteristic.Model, device.modelName)
      .setCharacteristic(Characteristic.SerialNumber, device.id);

    // set heater or thermostat service
    switch (accessoryType) {
      case 'HeaterCooler':
        this.heater = this.initializeHeater(device);
        break;
      case 'Thermostat':
        this.thermostat = this.initializeThermostat(device);
        break;
      default:
        throw new Error(`Invalid accessory type: ${accessoryType}`);
    }
  }

  private get log() {
    return this.platform.log;
  }

  private initializeHeater(device: NavienDevice): Service {
    const {
      Characteristic: {
        Name,
        Active,
        CurrentHeaterCoolerState,
        TargetHeaterCoolerState,
        CurrentTemperature,
        HeatingThresholdTemperature,
        LockPhysicalControls,
        TemperatureDisplayUnits,
      },
      Service: {
        HeaterCooler,
      },
    } = this.platform;
    const { HAPStatus, HapStatusError } = this.platform.api.hap;

    const heater = this.accessory.getService(HeaterCooler)
      || this.accessory.addService(HeaterCooler);

    // name, temp unit
    heater.setCharacteristic(Name, device.name);
    heater.getCharacteristic(TemperatureDisplayUnits)
      .setProps({
        validValues: [TemperatureDisplayUnits.CELSIUS],
      })
      .setValue(TemperatureDisplayUnits.CELSIUS);

    // active state
    heater.getCharacteristic(Active)
      .onGet(this.getActive.bind(this))
      .onSet(this.setActive.bind(this));

    // current state
    heater.getCharacteristic(CurrentHeaterCoolerState)
      .onGet(this.getHeaterState.bind(this));

    // target state
    heater.getCharacteristic(TargetHeaterCoolerState)
      .setProps({
        validValues: [TargetHeaterCoolerState.HEAT],
      })
      .setValue(TargetHeaterCoolerState.HEAT);

    // current temperature
    heater.getCharacteristic(CurrentTemperature)
      .onGet(this.getTemperature.bind(this));

    // target temperature
    const { heatRange } = device.functions;
    heater.getCharacteristic(HeatingThresholdTemperature)
      .setProps({
        minValue: heatRange.min,
        maxValue: heatRange.max,
        minStep: heatRange.step,
      })
      .onGet(this.getTemperature.bind(this))
      .onSet(this.setTemperature.bind(this));

    // lock
    heater.getCharacteristic(LockPhysicalControls)
      .onGet(this.getLocked.bind(this))
      .onSet(this.setLocked.bind(this));

    // subscribe to device events
    this.deviceStatus.activeChanges.subscribe((isActive) => {
      if (isActive === null) {
        heater.updateCharacteristic(Active, new HapStatusError(HAPStatus.SERVICE_COMMUNICATION_FAILURE));
        return;
      }
      heater.updateCharacteristic(Active, isActive ? Active.ACTIVE : Active.INACTIVE);
    });
    this.deviceStatus.temperatureChanges.subscribe((temperature) => {
      if (temperature === null) {
        heater.updateCharacteristic(CurrentTemperature, new HapStatusError(HAPStatus.SERVICE_COMMUNICATION_FAILURE));
        heater.updateCharacteristic(HeatingThresholdTemperature, new HapStatusError(HAPStatus.SERVICE_COMMUNICATION_FAILURE));
        return;
      }
      heater.updateCharacteristic(CurrentTemperature, temperature);
      heater.updateCharacteristic(HeatingThresholdTemperature, temperature);
    });
    this.deviceStatus.lockedChanges.subscribe((isLocked) => {
      if (isLocked === null) {
        heater.updateCharacteristic(LockPhysicalControls, new HapStatusError(HAPStatus.SERVICE_COMMUNICATION_FAILURE));
        return;
      }
      heater.updateCharacteristic(LockPhysicalControls, isLocked);
    });

    return heater;
  }

  private initializeThermostat(device: NavienDevice): Service {
    const {
      Characteristic: {
        Name,
        CurrentHeatingCoolingState,
        TargetHeatingCoolingState,
        CurrentTemperature,
        TargetTemperature,
        TemperatureDisplayUnits,
      },
      Service: {
        Thermostat,
      },
    } = this.platform;

    const thermostat = this.accessory.getService(Thermostat)
      || this.accessory.addService(Thermostat);

    // name, temp unit
    thermostat.setCharacteristic(Name, device.name);
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
      })
      .onGet(this.getHeatingState.bind(this));

    // target state
    thermostat.getCharacteristic(TargetHeatingCoolingState)
      .setProps({
        validValues: [
          TargetHeatingCoolingState.OFF,
          TargetHeatingCoolingState.HEAT,
        ],
      })
      .onGet(this.getHeatingState.bind(this))
      .onSet(this.setHeatingState.bind(this));

    // target temperature
    const { heatRange } = device.functions;
    thermostat.getCharacteristic(TargetTemperature)
      .setProps({
        minValue: heatRange.min,
        maxValue: heatRange.max,
        minStep: heatRange.step,
      })
      .onGet(this.getTemperature.bind(this))
      .onSet(this.setTemperature.bind(this));

    // current temperature
    thermostat.getCharacteristic(CurrentTemperature)
      .onGet(this.getTemperature.bind(this));

    // subscribe to device events
    this.deviceStatus.activeChanges.subscribe((isActive) => {
      thermostat.updateCharacteristic(
        CurrentHeatingCoolingState,
        isActive ? CurrentHeatingCoolingState.HEAT : CurrentHeatingCoolingState.OFF,
      );
      thermostat.updateCharacteristic(
        TargetHeatingCoolingState,
        isActive ? TargetHeatingCoolingState.HEAT : TargetHeatingCoolingState.OFF,
      );
    });
    this.deviceStatus.temperatureChanges.subscribe((temperature) => {
      thermostat.updateCharacteristic(TargetTemperature, temperature);
      thermostat.updateCharacteristic(CurrentTemperature, temperature);
    });

    return thermostat;
  }


  private async getActive(): Promise<CharacteristicValue> {
    const { Characteristic } = this.platform;
    const { HAPStatus, HapStatusError } = this.platform.api.hap;
    const { isActive } = this.deviceStatus;

    if (isActive === null) {
      this.log.info('Get Active: not responding');
      throw new HapStatusError(HAPStatus.SERVICE_COMMUNICATION_FAILURE);
    }

    this.log.info('Get Active:', isActive ? 'ACTIVE' : 'INACTIVE');

    const state = isActive ? Characteristic.Active.ACTIVE : Characteristic.Active.INACTIVE;
    return state;
  }

  private async setActive(value: CharacteristicValue) {
    const state = value as number;
    const isActive = !!state;

    this.log.info('Set Active:', isActive ? 'ACTIVE' : 'INACTIVE');

    await this.service.activate(this.device, isActive);
  }

  private async getHeaterState(): Promise<CharacteristicValue> {
    const { Characteristic } = this.platform;
    const { HAPStatus, HapStatusError } = this.platform.api.hap;
    const { isActive, isIdle } = this.deviceStatus;

    if (isActive === null) {
      this.log.info('Get Heater State: not responding');
      throw new HapStatusError(HAPStatus.SERVICE_COMMUNICATION_FAILURE);
    }

    const state = (() => {
      if (!isActive) {
        return [Characteristic.CurrentHeaterCoolerState.INACTIVE, 'INACTIVE'];
      }
      return isIdle ?
        [Characteristic.CurrentHeaterCoolerState.IDLE, 'IDLE'] :
        [Characteristic.CurrentHeaterCoolerState.HEATING, 'HEATING'];
    })();

    this.log.info('Get Heater State:', state[1]);

    return state[0];
  }

  private async getHeatingState(): Promise<CharacteristicValue> {
    const { Characteristic } = this.platform;
    const { HAPStatus, HapStatusError } = this.platform.api.hap;
    const { isActive } = this.deviceStatus;

    if (isActive === null) {
      this.log.info('Get Heating State: not responding');
      throw new HapStatusError(HAPStatus.SERVICE_COMMUNICATION_FAILURE);
    }

    this.log.info('Get Heating State:', isActive ? 'HEAT' : 'OFF');

    const state = isActive ? Characteristic.CurrentHeatingCoolingState.HEAT : Characteristic.CurrentHeatingCoolingState.OFF;
    return state;
  }

  private async setHeatingState(value: CharacteristicValue) {
    const state = value as number;
    const isActive = !!state;

    this.log.info('Set Heating State:', isActive ? 'HEAT' : 'OFF');

    await this.service.activate(this.device, isActive);
  }

  private async getTemperature(): Promise<CharacteristicValue> {
    const { HAPStatus, HapStatusError } = this.platform.api.hap;
    const { temperature } = this.deviceStatus;

    if (temperature === null) {
      this.log.info('Get Temperature: not responding');
      throw new HapStatusError(HAPStatus.SERVICE_COMMUNICATION_FAILURE);
    }

    this.log.info('Get Temperature:', temperature);

    return temperature;
  }

  private async setTemperature(value: CharacteristicValue) {
    const temperature = value as number;

    this.log.info('Set Temperature:', temperature);

    await this.service.setTemperature(this.device, temperature);
  }

  private async getLocked(): Promise<CharacteristicValue> {
    const { HAPStatus, HapStatusError } = this.platform.api.hap;
    const { isLocked } = this.deviceStatus;

    if (isLocked === null) {
      this.log.info('Get Locked: not responding');
      throw new HapStatusError(HAPStatus.SERVICE_COMMUNICATION_FAILURE);
    }

    this.log.info('Get Locked:', isLocked);

    return isLocked;
  }

  private async setLocked(value: CharacteristicValue) {
    const isLocked = !!value;

    this.log.info('Set Locked:', isLocked);

    await this.service.lock(this.device, isLocked);
  }
}
