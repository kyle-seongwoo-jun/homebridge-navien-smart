import { Service } from 'homebridge';

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

    // subscribe to device events
    this.deviceStatus.isPowerOnChanges.subscribe((isPowerOn: boolean) => {
      heater.updateCharacteristic(Active, isPowerOn ? Active.ACTIVE : Active.INACTIVE);
    });
    this.deviceStatus.currentTemperatureChanges.subscribe((temperature: number) => {
      const { isPowerOn, isIdle } = this.deviceStatus;
      heater.updateCharacteristic(CurrentTemperature, temperature);
      // We may need to update CurrentHeaterCoolerState since isIdle may have changed
      heater.updateCharacteristic(CurrentHeaterCoolerState, this.getCurrentHeaterState(isPowerOn, isIdle));
    });
    this.deviceStatus.targetTemperatureChanges.subscribe((temperature: number) => {
      const { isPowerOn, isIdle } = this.deviceStatus;
      heater.updateCharacteristic(HeatingThresholdTemperature, temperature);
      // We may need to update CurrentHeaterCoolerState since isIdle may have changed
      heater.updateCharacteristic(CurrentHeaterCoolerState, this.getCurrentHeaterState(isPowerOn, isIdle));
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
    this.deviceStatus.currentTemperatureChanges.subscribe((temperature: number) => {
      thermostat.updateCharacteristic(CurrentTemperature, temperature);
    });
    this.deviceStatus.targetTemperatureChanges.subscribe((temperature: number) => {
      thermostat.updateCharacteristic(TargetTemperature, temperature);
    });

    return thermostat;
  }
}
