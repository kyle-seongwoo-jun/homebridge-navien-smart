import { CharacteristicValue, Service } from 'homebridge';

import { NavienHomebridgePlatform, NavienPlatformAccessory } from '../platform.js';
import { HeatingMat } from './heating-mat.device.js';

export class DoubleHeatingMat extends HeatingMat {
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
    const name = this.displayName?.mainSwitch || this.device.nicknames.main;
    mainSwitch.addOptionalCharacteristic(ConfiguredName);
    mainSwitch.setCharacteristic(ConfiguredName, name);

    mainSwitch.getCharacteristic(On)
      .onGet(this.getPower.bind(this))
      .onSet(this.setPower.bind(this));

    // subscribe to device events
    this.deviceStatus.isPowerOnChanges.subscribe((isPowerOn: boolean) => {
      this.log.debug('[HB] Update Power:', isPowerOn ? 'ON' : 'OFF');
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
    const nameLeft = this.displayName?.left || this.device.nicknames.left!;
    const nameRight = this.displayName?.right || this.device.nicknames.right!;
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
      .onGet(this.getCurrentTemperatureLeft.bind(this));
    heaterRight.getCharacteristic(CurrentTemperature)
      .onGet(this.getCurrentTemperatureRight.bind(this));

    // target temperature
    heaterLeft.getCharacteristic(HeatingThresholdTemperature)
      .onGet(this.getTargetTemperatureLeft.bind(this))
      .onSet(this.setTargetTemperatureLeft.bind(this));
    heaterRight.getCharacteristic(HeatingThresholdTemperature)
      .onGet(this.getTargetTemperatureRight.bind(this))
      .onSet(this.setTargetTemperatureRight.bind(this));

    // subscribe to device events
    this.deviceStatus.isPowerOnChanges.subscribe((isPowerOn: boolean) => {
      const { isLeftEnabled, isRightEnabled, isLeftIdle, isRightIdle } = this.deviceStatus;
      const isLeftRunning = isPowerOn && isLeftEnabled;
      const isRightRunning = isPowerOn && isRightEnabled;

      this.log.debug(`[HB] Update Running: ${isLeftRunning ? 'ON' : 'OFF'}, zone: left`);
      this.log.debug(`[HB] Update Running: ${isRightRunning ? 'ON' : 'OFF'}, zone: right`);
      heaterLeft.updateCharacteristic(Active, isLeftRunning ? Active.ACTIVE : Active.INACTIVE);
      heaterRight.updateCharacteristic(Active, isRightRunning ? Active.ACTIVE : Active.INACTIVE);

      const [stateLeft, stateLeftString] = this.getCurrentHeaterStateWithString(isLeftRunning, isLeftIdle);
      const [stateRight, stateRightString] = this.getCurrentHeaterStateWithString(isRightRunning, isRightIdle);

      this.log.debug(`[HB] Update Heater State: ${stateLeftString}, zone: left`);
      this.log.debug(`[HB] Update Heater State: ${stateRightString}, zone: right`);
      heaterLeft.updateCharacteristic(CurrentHeaterCoolerState, stateLeft);
      heaterRight.updateCharacteristic(CurrentHeaterCoolerState, stateRight);
    });

    this.deviceStatus.isLeftEnabledChanges.subscribe((isLeftEnabled: boolean) => {
      const { isPowerOn, isLeftIdle } = this.deviceStatus;
      const isLeftRunning = isPowerOn && isLeftEnabled;

      this.log.debug(`[HB] Update Running: ${isLeftRunning ? 'ON' : 'OFF'}, zone: left`);
      heaterLeft.updateCharacteristic(Active, isLeftRunning ? Active.ACTIVE : Active.INACTIVE);

      const [stateLeft, stateLeftString] = this.getCurrentHeaterStateWithString(isLeftRunning, isLeftIdle);
      this.log.debug(`[HB] Update Heater State: ${stateLeftString}, zone: left`);
      heaterLeft.updateCharacteristic(CurrentHeaterCoolerState, stateLeft);
    });
    this.deviceStatus.isRightEnabledChanges.subscribe((isRightEnabled: boolean) => {
      const { isPowerOn, isRightIdle } = this.deviceStatus;
      const isRightRunning = isPowerOn && isRightEnabled;

      this.log.debug(`[HB] Update Running: ${isRightRunning ? 'ON' : 'OFF'}, zone: right`);
      heaterRight.updateCharacteristic(Active, isRightRunning ? Active.ACTIVE : Active.INACTIVE);

      const [stateRight, stateRightString] = this.getCurrentHeaterStateWithString(isRightRunning, isRightIdle);
      this.log.debug(`[HB] Update Heater State: ${stateRightString}, zone: right`);
      heaterRight.updateCharacteristic(CurrentHeaterCoolerState, stateRight);
    });

    this.deviceStatus.leftCurrentTemperatureChanges.subscribe((temperature: number) => {
      const { isPowerOn, isLeftEnabled, isLeftIdle } = this.deviceStatus;

      this.log.debug(`[HB] Update Current Temperature: ${temperature}, zone: left`);
      heaterLeft.updateCharacteristic(CurrentTemperature, temperature);

      const [stateLeft, stateLeftString] = this.getCurrentHeaterStateWithString(isPowerOn && isLeftEnabled, isLeftIdle);
      this.log.debug(`[HB] Update Heater State: ${stateLeftString}, zone: left`);
      heaterLeft.updateCharacteristic(CurrentHeaterCoolerState, stateLeft);
    });
    this.deviceStatus.rightCurrentTemperatureChanges.subscribe((temperature: number) => {
      const { isPowerOn, isRightEnabled, isRightIdle } = this.deviceStatus;

      this.log.debug(`[HB] Update Current Temperature: ${temperature}, zone: right`);
      heaterRight.updateCharacteristic(CurrentTemperature, temperature);

      const [stateRight, stateRightString] = this.getCurrentHeaterStateWithString(isPowerOn && isRightEnabled, isRightIdle);
      this.log.debug(`[HB] Update Heater State: ${stateRightString}, zone: right`);
      heaterRight.updateCharacteristic(CurrentHeaterCoolerState, stateRight);
    });

    this.deviceStatus.leftTargetTemperatureChanges.subscribe((temperature: number) => {
      const { isPowerOn, isLeftEnabled, isLeftIdle } = this.deviceStatus;

      this.log.debug(`[HB] Update Target Temperature: ${temperature}, zone: left`);
      heaterLeft.updateCharacteristic(HeatingThresholdTemperature, temperature);

      // We may need to update CurrentHeaterCoolerState since isLeftIdle may have changed
      const [stateLeft, stateLeftString] = this.getCurrentHeaterStateWithString(isPowerOn && isLeftEnabled, isLeftIdle);
      this.log.debug(`[HB] Update Heater State: ${stateLeftString}, zone: left`);
      heaterLeft.updateCharacteristic(CurrentHeaterCoolerState, stateLeft);
    });
    this.deviceStatus.rightTargetTemperatureChanges.subscribe((temperature: number) => {
      const { isPowerOn, isRightEnabled, isRightIdle } = this.deviceStatus;

      this.log.debug(`[HB] Update Target Temperature: ${temperature}, zone: right`);
      heaterRight.updateCharacteristic(HeatingThresholdTemperature, temperature);

      // We may need to update CurrentHeaterCoolerState since isRightIdle may have changed
      const [stateRight, stateRightString] = this.getCurrentHeaterStateWithString(isPowerOn && isRightEnabled, isRightIdle);
      this.log.debug(`[HB] Update Heater State: ${stateRightString}, zone: right`);
      heaterRight.updateCharacteristic(CurrentHeaterCoolerState, stateRight);
    });

    this.deviceStatus.lockedChanges.subscribe((isLocked: boolean) => {
      this.log.debug('[HB] Update Locked:', isLocked);
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
    const nameLeft = this.displayName?.left || this.device.nicknames.left!;
    const nameRight = this.displayName?.right || this.device.nicknames.right!;
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
      .onGet(this.getCurrentTemperatureLeft.bind(this));
    thermostatRight.getCharacteristic(CurrentTemperature)
      .onGet(this.getCurrentTemperatureRight.bind(this));

    // target temperature
    thermostatLeft.getCharacteristic(TargetTemperature)
      .onGet(this.getTargetTemperatureLeft.bind(this))
      .onSet(this.setTargetTemperatureLeft.bind(this));
    thermostatRight.getCharacteristic(TargetTemperature)
      .onGet(this.getTargetTemperatureRight.bind(this))
      .onSet(this.setTargetTemperatureRight.bind(this));

    // subscribe to device events
    this.deviceStatus.isPowerOnChanges.subscribe((isPowerOn: boolean) => {
      const { isLeftEnabled, isRightEnabled } = this.deviceStatus;

      this.log.debug(`[HB] Update Running: ${isPowerOn && isLeftEnabled ? 'ON' : 'OFF'}, zone: left`);
      thermostatLeft.updateCharacteristic(
        CurrentHeatingCoolingState,
        isPowerOn && isLeftEnabled ? CurrentHeatingCoolingState.HEAT : CurrentHeatingCoolingState.OFF,
      );
      thermostatLeft.updateCharacteristic(
        TargetHeatingCoolingState,
        isPowerOn && isLeftEnabled ? TargetHeatingCoolingState.HEAT : TargetHeatingCoolingState.OFF,
      );

      this.log.debug(`[HB] Update Running: ${isPowerOn && isRightEnabled ? 'ON' : 'OFF'}, zone: right`);
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

      this.log.debug(`[HB] Update Running: ${isLeftRunning ? 'ON' : 'OFF'}, zone: left`);
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

      this.log.debug(`[HB] Update Running: ${isRightRunning ? 'ON' : 'OFF'}, zone: right`);
      thermostatRight.updateCharacteristic(
        CurrentHeatingCoolingState,
        isRightRunning ? CurrentHeatingCoolingState.HEAT : CurrentHeatingCoolingState.OFF,
      );
      thermostatRight.updateCharacteristic(
        TargetHeatingCoolingState,
        isRightRunning ? TargetHeatingCoolingState.HEAT : TargetHeatingCoolingState.OFF,
      );
    });

    this.deviceStatus.leftCurrentTemperatureChanges.subscribe((temperature: number) => {
      this.log.debug(`[HB] Update Current Temperature: ${temperature}, zone: left`);
      thermostatLeft.updateCharacteristic(CurrentTemperature, temperature);
    });
    this.deviceStatus.rightCurrentTemperatureChanges.subscribe((temperature: number) => {
      this.log.debug(`[HB] Update Current Temperature: ${temperature}, zone: right`);
      thermostatRight.updateCharacteristic(CurrentTemperature, temperature);
    });

    this.deviceStatus.leftTargetTemperatureChanges.subscribe((temperature: number) => {
      this.log.debug(`[HB] Update Target Temperature: ${temperature}, zone: left`);
      thermostatLeft.updateCharacteristic(TargetTemperature, temperature);
    });
    this.deviceStatus.rightTargetTemperatureChanges.subscribe((temperature: number) => {
      this.log.debug(`[HB] Update Target Temperature: ${temperature}, zone: right`);
      thermostatRight.updateCharacteristic(TargetTemperature, temperature);
    });

    return [thermostatLeft, thermostatRight];
  }

  private getServiceBy(zone: 'left' | 'right'): Service {
    switch (zone) {
      case 'left':
        return this.accessoryType === 'HeaterCooler' ?
          this.heaterLeft! :
          this.thermostatLeft!;
      case 'right':
        return this.accessoryType === 'HeaterCooler' ?
          this.heaterRight! :
          this.thermostatRight!;
    }
  }

  private async getRunningLeft(): Promise<CharacteristicValue> {
    return this.getPower('left');
  }

  private async getRunningRight(): Promise<CharacteristicValue> {
    return this.getPower('right');
  }

  private async setRunningLeft(value: CharacteristicValue) {
    return this.setRunning(value, 'left');
  }

  private async setRunningRight(value: CharacteristicValue) {
    return this.setRunning(value, 'right');
  }

  private async setRunning(value: CharacteristicValue, zone: 'left' | 'right') {
    const isRunning = !!value;
    const { isPowerOn } = this.deviceStatus;
    const [isZoneEnabled, isOtherZoneEnabled] = this.deviceStatus.getZoneEnables(zone);

    // turn on/off the device
    if ((isRunning && !isPowerOn && isZoneEnabled) ||
      (!isRunning && isPowerOn && !isOtherZoneEnabled)) {
      return this.setPower(isRunning);
    }

    const { heatRange } = this.device.functions;
    const {
      Characteristic: {
        TargetTemperature,
      },
    } = this.platform;

    // enable/disable the zone by setting temperature to min
    const temperature = isRunning ? heatRange.min + heatRange.step : heatRange.min;

    this.log.debug(`[HB] Set Running: ${isRunning ? 'ON' : 'OFF'}, zone: ${zone}`);
    this.getServiceBy(zone).updateCharacteristic(TargetTemperature, temperature);
    await this.service.setTemperature(this.device, temperature, zone);
  }

  // Only used for HeaterCooler Service
  private async getHeaterStateLeft(): Promise<CharacteristicValue> {
    return this.getHeaterState('left');
  }

  // Only used for HeaterCooler Service
  private async getHeaterStateRight(): Promise<CharacteristicValue> {
    return this.getHeaterState('right');
  }

  private async getCurrentTemperatureLeft(): Promise<CharacteristicValue> {
    return this.getCurrentTemperature('left');
  }

  private async getCurrentTemperatureRight(): Promise<CharacteristicValue> {
    return this.getCurrentTemperature('right');
  }

  private async getTargetTemperatureLeft(): Promise<CharacteristicValue> {
    return this.getTargetTemperature('left');
  }

  private async getTargetTemperatureRight(): Promise<CharacteristicValue> {
    return this.getTargetTemperature('right');
  }

  private async setTargetTemperatureLeft(value: CharacteristicValue) {
    return this.setTargetTemperature(value, 'left');
  }

  private async setTargetTemperatureRight(value: CharacteristicValue) {
    return this.setTargetTemperature(value, 'right');
  }
}
