import { CharacteristicValue, Service } from 'homebridge';

import { NavienDevice } from '../navien/navien.device';
import { NavienService } from '../navien/navien.service';
import { NavienHomebridgePlatform, NavienPlatformAccessory } from '../platform';

export default class ElectricMat {
  private readonly heater?: Service;
  private readonly thermostat?: Service;
  private readonly service: NavienService;
  private readonly device: NavienDevice;

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

    // set accessory information
    this.accessory.getService(Service.AccessoryInformation)!
      .setCharacteristic(Characteristic.Manufacturer, 'Navien')
      .setCharacteristic(Characteristic.Model, device.modelName)
      .setCharacteristic(Characteristic.SerialNumber, device.id);

    // set heater or thermostat service
    if (accessoryType === 'HeaterCooler') {
      this.heater = this.initializeHeater(device);
    } else if (accessoryType === 'Thermostat') {
      this.thermostat = this.initializeThermostat(device);
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
        TemperatureDisplayUnits,
      },
      Service: {
        HeaterCooler,
      },
    } = this.platform;

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
    const { heat } = device.functions;
    heater.getCharacteristic(HeatingThresholdTemperature)
      .setProps({
        minValue: heat.min,
        maxValue: heat.max,
        minStep: heat.step,
      })
      .onGet(this.getTemperature.bind(this))
      .onSet(this.setTemperature.bind(this));

    // subscribe to device events
    device.powerChanges.subscribe((power) => {
      heater.updateCharacteristic(Active, power ? Active.ACTIVE : Active.INACTIVE);
    });
    device.temperatureChanges.subscribe((temperature) => {
      heater.updateCharacteristic(CurrentTemperature, temperature);
      heater.updateCharacteristic(HeatingThresholdTemperature, temperature);
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
    const { heat } = device.functions;
    thermostat.getCharacteristic(TargetTemperature)
      .setProps({
        minValue: heat.min,
        maxValue: heat.max,
        minStep: heat.step,
      })
      .onGet(this.getTemperature.bind(this))
      .onSet(this.setTemperature.bind(this));

    // current temperature
    thermostat.getCharacteristic(CurrentTemperature)
      .onGet(this.getTemperature.bind(this));

    // subscribe to device events
    device.powerChanges.subscribe((power) => {
      thermostat.updateCharacteristic(CurrentHeatingCoolingState, power ? CurrentHeatingCoolingState.HEAT : CurrentHeatingCoolingState.OFF);
      thermostat.updateCharacteristic(TargetHeatingCoolingState, power ? TargetHeatingCoolingState.HEAT : TargetHeatingCoolingState.OFF);
    });
    device.temperatureChanges.subscribe((temperature) => {
      thermostat.updateCharacteristic(TargetTemperature, temperature);
      thermostat.updateCharacteristic(CurrentTemperature, temperature);
    });

    return thermostat;
  }


  private async getActive(): Promise<CharacteristicValue> {
    const { Characteristic } = this.platform;
    const { power } = this.device;

    this.log.info('Get Active:', power ? 'ON' : 'OFF');

    const state = power ? Characteristic.Active.ACTIVE : Characteristic.Active.INACTIVE;
    return state;
  }

  private async setActive(value: CharacteristicValue) {
    const state = value as number;
    const power = !!state;

    this.log.info('Set Active:', power ? 'ON' : 'OFF');

    await this.service.setPower(this.device, power);
  }

  private async getHeaterState(): Promise<CharacteristicValue> {
    const { Characteristic } = this.platform;
    const { power, isIdle } = this.device;

    const state = (() => {
      if (!power) {
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
    const { power } = this.device;

    this.log.info('Get Heating State:', power ? 'ON' : 'OFF');

    const state = power ? Characteristic.CurrentHeatingCoolingState.HEAT : Characteristic.CurrentHeatingCoolingState.OFF;
    return state;
  }

  private async setHeatingState(value: CharacteristicValue) {
    const state = value as number;
    const power = !!state;

    this.log.info('Set Heating State:', power ? 'ON' : 'OFF');

    await this.service.setPower(this.device, power);
  }

  private async getTemperature(): Promise<CharacteristicValue> {
    const { temperature } = this.device;

    this.log.info('Get Temperature:', temperature);

    return temperature;
  }

  private async setTemperature(value: CharacteristicValue) {
    const temperature = value as number;

    this.log.info('Set Temperature:', temperature);

    await this.service.setTemperature(this.device, temperature);
  }
}
