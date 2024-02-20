import { Logger } from 'homebridge';
import { BehaviorSubject, Subscription } from 'rxjs';

import { OperationMode } from '../aws/interfaces';
import { AwsPubSub } from '../aws/pubsub';
import { Device } from './interfaces';
import { NavienApi } from './navien.api';

const DEFALUT_POWER = false;
const DEFALUT_TEMPERATURE = 30;

export class NavienDevice {
  private _power = DEFALUT_POWER;
  private _temperature = DEFALUT_TEMPERATURE;

  private readonly powerSubject = new BehaviorSubject<boolean>(DEFALUT_POWER);
  private readonly temperatureSubject = new BehaviorSubject<number>(DEFALUT_TEMPERATURE);
  private readonly subcription: Subscription;

  constructor(
    private readonly log: Logger,
    private readonly api: NavienApi,
    private readonly pubsub: AwsPubSub,
    private readonly json: Device,
  ) {
    // initialize event subscription
    this.subcription = this.pubsub.deviceStatusChanges(this.id).subscribe((event) => {
      const state = event.state.reported!;
      const power = state.operationMode === OperationMode.ON;
      const temperature = state.heater.left.temperature.set; // TODO: handle left and right
      this.log.debug('Device status changed', { power, temperature });

      this.power = power;
      this.temperature = temperature;
    });
  }

  get id() {
    return this.json.deviceId;
  }

  get modelName() {
    return this.json.modelName;
  }

  get name() {
    return this.json.Properties.nickName.mainItem;
  }

  get functions() {
    return this.json.Properties.registry.attributes.functions;
  }

  get power() {
    return this._power;
  }

  set power(value: boolean) {
    if (this._power === value) {
      return;
    }
    this._power = value;
    this.powerSubject.next(value);
  }

  get isIdle() {
    const { heatControl } = this.json.Properties.registry.attributes.functions;
    const idleTemperature = heatControl.rangeMin - parseFloat(heatControl.unit);
    return this._power && this._temperature === idleTemperature;
  }

  get temperature() {
    return this._temperature;
  }

  set temperature(value: number) {
    if (this._temperature === value) {
      return;
    }
    this._temperature = value;
    this.temperatureSubject.next(value);
  }

  get powerChanges() {
    return this.powerSubject.asObservable();
  }

  get temperatureChanges() {
    return this.temperatureSubject.asObservable();
  }

  initialize() {
    return this.api.initializeDevice(this.json);
  }

  setPower(power: boolean) {
    return this.api.setPower(this.json, power);
  }

  setTemperature(temperature: number) {
    return this.api.setTemperature(this.json, temperature);
  }

  dispose() {
    this.subcription.unsubscribe();
  }
}
