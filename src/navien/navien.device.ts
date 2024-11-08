import { Logger } from 'homebridge';
import { BehaviorSubject, Subscription } from 'rxjs';

import { OperationMode } from '../aws/interfaces';
import { AwsPubSub } from '../aws/pubsub';
import { Device } from './interfaces';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface NavienDevice extends Device { }

export class NavienDevice {
  private _isActive: boolean | null = null;
  private _temperature: number | null = null;
  private _isLocked: boolean | null = null;
  public isDouble: boolean | null = null;

  private readonly isActiveSubject = new BehaviorSubject<boolean | null>(null);
  private readonly temperatureSubject = new BehaviorSubject<number | null>(null);
  private readonly isLockedSubject = new BehaviorSubject<boolean | null>(null);
  private readonly subcription: Subscription;

  constructor(
    private readonly log: Logger,
    private readonly pubsub: AwsPubSub,
    json: Device,
  ) {
    Object.assign(this, json);

    // initialize event subscription
    this.subcription = this.pubsub.deviceStatusChanges(this.id).subscribe((event) => {
      this.log.debug('[AWS PubSub] device status changed:', JSON.stringify(event));

      const state = event.payload.state.reported!;

      // state has connected property only when device is disconnected
      if (!state.connected) {
        this.log.info('[AWS PubSub] device disconnected', { name: this.name });
        this.isActive = false;
        this.temperature = null;
        this.isLocked = null;
        return;
      }

      // status update
      const isActive = state.operationMode === OperationMode.ON;
      const temperature = ('left' in state.heater ?
        state.heater.left : // TODO: handle left and right
        state.heater.single
      ).temperature.set;
      const doubleTemperature = 'left' in state.heater ?
        { left: state.heater.left.temperature.set, right: state.heater.right.temperature.set } :
        temperature;
      const isLocked = state.childLock;
      this.log.info('[AWS PubSub] current status:', { name: this.name, isActive, temperature: doubleTemperature, isLocked });

      this.isActive = isActive;
      this.temperature = temperature;
      this.isLocked = isLocked;
      this.isDouble = 'left' in state.heater;
    });
  }

  get id() {
    return this.deviceId;
  }

  get name() {
    return this.Properties.nickName.mainItem;
  }

  get functions() {
    const { functions } = this.Properties.registry.attributes;
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

  set isActive(value: boolean | null) {
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

  set temperature(value: number | null) {
    if (this._temperature === value) {
      return;
    }
    this._temperature = value;
    this.temperatureSubject.next(value);
  }

  get isLocked() {
    return this._isLocked;
  }

  set isLocked(value: boolean | null) {
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

  dispose() {
    this.subcription.unsubscribe();
  }
}
