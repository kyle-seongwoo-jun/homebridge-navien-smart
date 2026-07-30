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
        CoolingThresholdTemperature,
        TargetHeaterCoolerState,
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
    if (this.device.functions.coolRange) {
      heater.getCharacteristic(CoolingThresholdTemperature)
        .onGet(this.getTargetTemperature.bind(this))
        .onSet(this.setTargetTemperature.bind(this));
    }

    // subscribe to device events
    this.deviceStatus.isPowerOnChanges.subscribe((isPowerOn: boolean) => {
      this.log.debug('[HB] Update Power:', isPowerOn ? 'ON' : 'OFF');
      heater.updateCharacteristic(Active, isPowerOn ? Active.ACTIVE : Active.INACTIVE);
    });
    this.deviceStatus.currentTemperatureChanges.subscribe((temperature: number) => {
      this.log.debug('[HB] Update Current Temperature:', temperature);
      heater.updateCharacteristic(CurrentTemperature, temperature);

      // We may need to update CurrentHeaterCoolerState since isIdle may have changed
      const { isPowerOn, isIdle } = this.deviceStatus;
      const [state, stateString] = this.getCurrentHeaterStateWithString(isPowerOn, isIdle);
      this.log.debug(`[HB] Update Heater State: ${stateString}`);
      heater.updateCharacteristic(CurrentHeaterCoolerState, state);
    });
    this.deviceStatus.targetTemperatureChanges.subscribe((temperature: number) => {
      this.log.debug('[HB] Update Target Temperature:', temperature);
      heater.updateCharacteristic(
        this.deviceStatus.isCooling ? CoolingThresholdTemperature : HeatingThresholdTemperature,
        temperature,
      );

      // We may need to update CurrentHeaterCoolerState since isIdle may have changed
      const { isPowerOn, isIdle } = this.deviceStatus;
      const [state, stateString] = this.getCurrentHeaterStateWithString(isPowerOn, isIdle);
      this.log.debug(`[HB] Update Heater State: ${stateString}`);
      heater.updateCharacteristic(CurrentHeaterCoolerState, state);
    });
    this.deviceStatus.seasonChanges.subscribe(() => {
      const targetMode = this.deviceStatus.isCooling ?
        TargetHeaterCoolerState.COOL :
        TargetHeaterCoolerState.HEAT;
      heater.updateCharacteristic(TargetHeaterCoolerState, targetMode);

      const { isPowerOn, isIdle } = this.deviceStatus;
      const [state] = this.getCurrentHeaterStateWithString(isPowerOn, isIdle);
      heater.updateCharacteristic(CurrentHeaterCoolerState, state);
    });
    this.deviceStatus.lockedChanges.subscribe((isLocked: boolean) => {
      this.log.debug('[HB] Update Locked:', isLocked);
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
      .onGet(this.getThermostatMode.bind(this));

    thermostat.getCharacteristic(TargetHeatingCoolingState)
      .onGet(this.getThermostatMode.bind(this))
      .onSet(this.setThermostatMode.bind(this));

    // current temperature
    thermostat.getCharacteristic(CurrentTemperature)
      .onGet(this.getCurrentTemperature.bind(this));

    // target temperature
    thermostat.getCharacteristic(TargetTemperature)
      .onGet(this.getTargetTemperature.bind(this))
      .onSet(this.setTargetTemperature.bind(this));

    // subscribe to device events
    this.deviceStatus.isPowerOnChanges.subscribe((isPowerOn: boolean) => {
      const activeState = this.deviceStatus.isCooling ?
        CurrentHeatingCoolingState.COOL :
        CurrentHeatingCoolingState.HEAT;
      const targetState = this.deviceStatus.isCooling ?
        TargetHeatingCoolingState.COOL :
        TargetHeatingCoolingState.HEAT;
      this.log.debug('[HB] Update Power:', isPowerOn ? 'ON' : 'OFF');
      thermostat.updateCharacteristic(
        CurrentHeatingCoolingState,
        isPowerOn ? activeState : CurrentHeatingCoolingState.OFF,
      );
      thermostat.updateCharacteristic(
        TargetHeatingCoolingState,
        isPowerOn ? targetState : TargetHeatingCoolingState.OFF,
      );
    });
    this.deviceStatus.seasonChanges.subscribe(() => {
      if (!this.deviceStatus.isPowerOn) {
        return;
      }
      thermostat.updateCharacteristic(
        CurrentHeatingCoolingState,
        this.deviceStatus.isCooling ? CurrentHeatingCoolingState.COOL : CurrentHeatingCoolingState.HEAT,
      );
      thermostat.updateCharacteristic(
        TargetHeatingCoolingState,
        this.deviceStatus.isCooling ? TargetHeatingCoolingState.COOL : TargetHeatingCoolingState.HEAT,
      );
    });
    this.deviceStatus.currentTemperatureChanges.subscribe((temperature: number) => {
      this.log.debug('[HB] Update Current Temperature:', temperature);
      thermostat.updateCharacteristic(CurrentTemperature, temperature);
    });
    this.deviceStatus.targetTemperatureChanges.subscribe((temperature: number) => {
      this.log.debug('[HB] Update Target Temperature:', temperature);
      thermostat.updateCharacteristic(TargetTemperature, temperature);
    });

    return thermostat;
  }
}
