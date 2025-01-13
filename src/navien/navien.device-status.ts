import { Logger } from 'homebridge';
import { BehaviorSubject, Subscription } from 'rxjs';

import { DoubleHeaterState, OperationMode, SingleHeaterState } from '../aws/interfaces/index.js';
import { AwsPubSub } from '../aws/pubsub.js';
import { NavienDevice } from './navien.device.js';

export class NavienDeviceStatusRepository {
  private _isActive: boolean | null = null;
  private _temperature: number | null = null;
  private _isLocked: boolean | null = null;
  private _isDouble: boolean | null = null;

  private readonly isActiveSubject = new BehaviorSubject<boolean | null>(null);
  private readonly temperatureSubject = new BehaviorSubject<number | null>(null);
  private readonly isLockedSubject = new BehaviorSubject<boolean | null>(null);
  private readonly subscription: Subscription;

  constructor(
    private readonly log: Logger,
    private readonly pubsub: AwsPubSub,
    public readonly device: NavienDevice,
  ) {
    this.subscription = this.pubsub.deviceStatusChanges(this.device.id).subscribe((event) => {
      this.log.debug('[AWS PubSub] device status changed:', JSON.stringify(event));

      const state = event.payload.state.reported!;

      // state has connected property only when device is disconnected
      if (!state.connected) {
        this.log.info('[AWS PubSub] device disconnected', { name: this.device.name });
        this.isActive = false;
        this.temperature = null;
        this.isLocked = null;
        return;
      }

      // status update
      if ('heater' in state) {
        const heater = state.heater!;
        if ('left' in heater || 'right' in heater) {
          this._isDouble = true;
        }
        if ('single' in heater) {
          this._isDouble = false;
        }
        const temperature = (this._isDouble ?
          // TODO: handle left and right
          (heater as DoubleHeaterState)?.left:
          (heater as SingleHeaterState)?.single
        )?.temperature?.set;
        if (temperature !== undefined) {
          this.temperature = temperature;
        }
      }
      if ('childLock' in state) {
        this.isLocked = state.childLock!;
      }
      if ('operationMode' in state) {
        this.isActive = (state.operationMode === OperationMode.ON);
      }

      // updated status
      this.log.info(
        '[AWS PubSub] current status:',
        { name: this.device.name, isActive: this.isActive, temperature: this.temperature, isLocked: this.isLocked },
      );
    });
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
    const { heatRange } = this.device.functions;
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

  get isDouble() {
    return this._isDouble;
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
    this.subscription.unsubscribe();
    this.isActiveSubject.complete();
    this.temperatureSubject.complete();
    this.isLockedSubject.complete();
  }
}
