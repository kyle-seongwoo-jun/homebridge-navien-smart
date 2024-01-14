import { CharacteristicValue, Service } from 'homebridge';

import { Device } from '../navien/navien.model';
import { NavienHomebridgePlatform, NavienPlatformAccessory } from '../platform';

export default class ElectricMat {
  private thermostat: Service;
  private VALID_HEATING_STATES: number[];

  private exampleStates = {
    heatingState: this.platform.Characteristic.CurrentHeatingCoolingState.OFF,
    temperature: 35,
  };

  constructor(
    private readonly platform: NavienHomebridgePlatform,
    private readonly accessory: NavienPlatformAccessory,
  ) {
    const {
      Characteristic,
      Service,
    } = this.platform;

    const { device } = accessory.context;

    // set accessory information
    this.accessory.getService(Service.AccessoryInformation)!
      .setCharacteristic(Characteristic.Manufacturer, 'Navien')
      .setCharacteristic(Characteristic.Model, device.modelName)
      .setCharacteristic(Characteristic.SerialNumber, device.deviceId);

    // set thermostat information
    this.VALID_HEATING_STATES = [
      Characteristic.CurrentHeatingCoolingState.OFF,
      Characteristic.CurrentHeatingCoolingState.HEAT,
    ];
    this.thermostat = this.initializeThermostat(device);
  }

  initializeThermostat(device: Device): Service {
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
    const name = device.Properties.nickName.mainItem;
    thermostat
      .setCharacteristic(Name, name)
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
    const { heatControl } = device.Properties.registry.attributes.functions;
    thermostat.getCharacteristic(TargetTemperature)
      .setProps({
        minValue: heatControl.rangeMin,
        maxValue: heatControl.rangeMax,
        minStep: parseFloat(heatControl.unit),
      })
      .onGet(this.getTemperature.bind(this))
      .onSet(this.setTemperature.bind(this));

    // current temperature
    thermostat.getCharacteristic(CurrentTemperature)
      .onGet(this.getTemperature.bind(this));

    return thermostat;
  }

  async getHeatingState(): Promise<CharacteristicValue> {
    // TODO: implement your own code to check if the device is on
    const state = this.exampleStates.heatingState;

    this.platform.log.debug('Get Heating State:', state ? 'ON' : 'OFF');

    return state;
  }

  async setHeatingState(value: CharacteristicValue) {
    const state = value as number;

    this.platform.log.debug('Set Heating State:', state ? 'ON' : 'OFF');

    // TODO: implement your own code to turn your device on/off
    this.exampleStates.heatingState = state;
  }

  async getTemperature(): Promise<CharacteristicValue> {
    // implement your own code to check the temperature
    const temperature = this.exampleStates.temperature;

    this.platform.log.debug('Get Temperature:', temperature);

    // if you need to return an error to show the device as "Not Responding" in the Home app:
    // throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);

    return temperature;
  }

  async setTemperature(value: CharacteristicValue) {
    const temperature = value as number;

    // implement your own code to set the brightness
    this.exampleStates.temperature = temperature;

    this.platform.log.debug('Set Temperature:', temperature);
  }
}
