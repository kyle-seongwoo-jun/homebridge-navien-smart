import { CharacteristicValue, Service } from 'homebridge';

import { NavienDevice } from '../navien/navien.device';
import { NavienService } from '../navien/navien.service';
import { NavienHomebridgePlatform, NavienPlatformAccessory } from '../platform';

export default class ElectricMat {
  private readonly VALID_HEATING_STATES: number[];

  private readonly thermostat: Service;
  private readonly service: NavienService;
  private readonly device: NavienDevice;

  constructor(
    private readonly platform: NavienHomebridgePlatform,
    private readonly accessory: NavienPlatformAccessory,
  ) {
    const {
      Characteristic,
      Service,
    } = this.platform;

    const { navienService } = this.platform;
    this.service = navienService;

    const { device } = accessory.context;
    this.device = device;

    // set accessory information
    this.accessory.getService(Service.AccessoryInformation)!
      .setCharacteristic(Characteristic.Manufacturer, 'Navien')
      .setCharacteristic(Characteristic.Model, device.modelName)
      .setCharacteristic(Characteristic.SerialNumber, device.id);

    // set thermostat information
    this.VALID_HEATING_STATES = [
      Characteristic.CurrentHeatingCoolingState.OFF,
      Characteristic.CurrentHeatingCoolingState.HEAT,
    ];
    this.thermostat = this.initializeThermostat(device);
  }

  private get log() {
    return this.platform.log;
  }

  initializeThermostat(device: NavienDevice): Service {
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
    thermostat
      .setCharacteristic(Name, device.name)
      .setCharacteristic(TemperatureDisplayUnits, TemperatureDisplayUnits.CELSIUS);

    // current state
    thermostat.getCharacteristic(CurrentHeatingCoolingState)
      .setProps({
        validValues: this.VALID_HEATING_STATES,
      })
      .onGet(this.getHeatingState.bind(this));

    // target state
    thermostat.getCharacteristic(TargetHeatingCoolingState)
      .setProps({
        validValues: this.VALID_HEATING_STATES,
      })
      .onGet(this.getHeatingState.bind(this))
      .onSet(this.setHeatingState.bind(this));

    // target temperature
    const { heatControl } = device.functions;
    thermostat.getCharacteristic(TargetTemperature)
      .setProps({
        minValue: heatControl.rangeMin,
        maxValue: heatControl.rangeMax,
        minStep: parseFloat(heatControl.unit),
      })
      .onGet(this.getTemperature.bind(this))
      .onSet(this.setTemperature.bind(this));

    // subscribe to device events
    device.powerChanges.subscribe((power) => {
      thermostat.updateCharacteristic(CurrentHeatingCoolingState, power ? CurrentHeatingCoolingState.HEAT : CurrentHeatingCoolingState.OFF);
      thermostat.updateCharacteristic(TargetHeatingCoolingState, power ? TargetHeatingCoolingState.HEAT : TargetHeatingCoolingState.OFF);
    });
    device.temperatureChanges.subscribe((temperature) => {
      thermostat.updateCharacteristic(TargetTemperature, temperature);
    });

    return thermostat;
  }

  async getHeatingState(): Promise<CharacteristicValue> {
    const { Characteristic } = this.platform;
    const { power } = this.device;

    this.log.debug('Get Heating State:', power ? 'ON' : 'OFF');

    const state = power ? Characteristic.CurrentHeatingCoolingState.HEAT : Characteristic.CurrentHeatingCoolingState.OFF;
    return state;
  }

  async setHeatingState(value: CharacteristicValue) {
    const state = value as number;
    const power = !!state;

    this.log.debug('Set Heating State:', power ? 'ON' : 'OFF');

    await this.service.setPower(this.device, power);
  }

  async getTemperature(): Promise<CharacteristicValue> {
    const { temperature } = this.device;

    this.log.debug('Get Temperature:', temperature);

    return temperature;
  }

  async setTemperature(value: CharacteristicValue) {
    const temperature = value as number;

    this.log.debug('Set Temperature:', temperature);

    await this.service.setTemperature(this.device, temperature);
  }
}
