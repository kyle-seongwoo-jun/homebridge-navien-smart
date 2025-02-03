import { CharacteristicValue, Service } from 'homebridge';

import { NavienHomebridgePlatform, NavienPlatformAccessory } from '../platform.js';
import { HeatingMat } from './heating-mat.device.js';

export class SingleHeatingMat extends HeatingMat {
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

    // power
    heater.getCharacteristic(Active)
      .onGet(this.getPower.bind(this))
      .onSet(this.setPower.bind(this));

    // current state
    heater.getCharacteristic(CurrentHeaterCoolerState)
      .onGet(this.getHeaterState.bind(this));

    // current temperature
    heater.getCharacteristic(CurrentTemperature)
      .onGet(this.getCurrentTemperature.bind(this));

    // target temperature
    heater.getCharacteristic(HeatingThresholdTemperature)
      .onGet(this.getTargetTemperature.bind(this))
      .onSet(this.setTargetTemperature.bind(this));

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

    // power
    thermostat.getCharacteristic(CurrentHeatingCoolingState)
      .onGet(this.getPower.bind(this));

    thermostat.getCharacteristic(TargetHeatingCoolingState)
      .onGet(this.getPower.bind(this))
      .onSet(this.setPower.bind(this));

    // current temperature
    thermostat.getCharacteristic(CurrentTemperature)
      .onGet(this.getCurrentTemperature.bind(this));

    // target temperature
    thermostat.getCharacteristic(TargetTemperature)
      .onGet(this.getTargetTemperature.bind(this))
      .onSet(this.setTargetTemperature.bind(this));

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
}
