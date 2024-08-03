import { Logging } from 'homebridge';
import { BehaviorSubject, Subscription } from 'rxjs';

import { OperationMode } from '../aws/interfaces';
import { AwsPubSub } from '../aws/pubsub';
import { Device } from './interfaces';
import { NavienApi } from './navien.api';

const DEFALUT_IS_ACTIVE = false;
const DEFALUT_TEMPERATURE = 30;
const DEFALUT_IS_LOCKED = false;

export class NavienDevice {
  private _isActive = DEFALUT_IS_ACTIVE;
  private _temperature = DEFALUT_TEMPERATURE;
  private _isLocked = DEFALUT_IS_LOCKED;

  private readonly isActiveSubject = new BehaviorSubject<boolean>(DEFALUT_IS_ACTIVE);
  private readonly temperatureSubject = new BehaviorSubject<number>(DEFALUT_TEMPERATURE);
  private readonly isLockedSubject = new BehaviorSubject<boolean>(DEFALUT_IS_LOCKED);
  private readonly subcription: Subscription;

  constructor(
    private readonly log: Logging,
    private readonly api: NavienApi,
    private readonly pubsub: AwsPubSub,
    private readonly json: Device,
  ) {
    // initialize event subscription
    this.subcription = this.pubsub.deviceStatusChanges(this.id).subscribe((event) => {
      this.log.debug('[AWS PubSub] device status changed:', JSON.stringify(event));

      const state = event.state.reported!;
      const isActive = state.operationMode === OperationMode.ON;
      const leftTemperature = state.heater.left.temperature.set;
      const rightTemperature = state.heater.right.temperature.set;
      const temperature = leftTemperature; // TODO: handle left and right
      const isLocked = state.childLock;
      this.log.info('[AWS PubSub] current status:', { name: this.name, isActive, leftTemperature, rightTemperature, isLocked });

      this.isActive = isActive;
      this.temperature = temperature;
      this.isLocked = isLocked;
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
    const { functions } = this.json.Properties.registry.attributes;
    const { heatControl } = functions;

    const step = parseFloat(heatControl.unit);
    const heatRange = {
      min: heatControl.rangeMin - step,
      max: heatControl.rangeMax,
      step: step,
    };

    return {
      heatRange,
    };
  }

  get isActive() {
    return this._isActive;
  }

  set isActive(value: boolean) {
    if (this._isActive === value) {
      return;
    }
    this._isActive = value;
    this.isActiveSubject.next(value);
  }

  get isIdle() {
    const { heatRange } = this.functions;
    return this._isActive && this._temperature === heatRange.min;
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

  get isLocked() {
    return this._isLocked;
  }

  set isLocked(value: boolean) {
    if (this._isLocked === value) {
      return;
    }
    this._isLocked = value;
    this.isLockedSubject.next(value);
  }

  get activeChanges() {
    return this.isActiveSubject.asObservable();
  }

  get temperatureChanges() {
    return this.temperatureSubject.asObservable();
  }

  get lockedChanges() {
    return this.isLockedSubject.asObservable();
  }

  initialize() {
    return this.api.initializeDevice(this.json);
  }

  activate(isActive: boolean) {
    return this.api.setOperationMode(this.json, isActive ? OperationMode.ON : OperationMode.OFF);
  }

  setTemperature(temperature: number) {
    return this.api.setTemperature(this.json, temperature, this.functions.heatRange);
  }

  lock(isLocked: boolean) {
    return this.api.setChildLock(this.json, isLocked);
  }

  dispose() {
    this.subcription.unsubscribe();
  }
}
