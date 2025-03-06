import { Logger } from 'homebridge';
import { BehaviorSubject, Subscription } from 'rxjs';

import { DoubleHeaterState, NavienReportedState, OperationMode, SingleHeaterState } from '../aws/interfaces/index.js';
import { AwsPubSub } from '../aws/pubsub.js';
import { HeatingZone } from './interfaces/index.js';
import { NavienDevice } from './navien.device.js';

interface NavienDeviceStatus {
  isConnected: boolean;
  isPowerOn?: boolean;
  isEnabled?: boolean;
  isEnabled2?: boolean;
  currentTemperature?: number;
  targetTemperature?: number;
  currentTemperature2?: number;
  targetTemperature2?: number;
  isLocked?: boolean;
}

class NavienDeviceStatusParser {
  constructor(private readonly isDouble: boolean) { }

  parseStatusFrom(state: NavienReportedState): NavienDeviceStatus {
    const isConnected = state.connected;
    const status: NavienDeviceStatus = { isConnected };

    // if device is disconnected,
    // no need to parse other properties
    if (!isConnected) {
      return status;
    }

    // power on/off
    status.isPowerOn = 'operationMode' in state ?
      state.operationMode! === OperationMode.ON :
      undefined;

    // temperature
    if ('heater' in state) {
      const heater = state.heater!;
      if (this.isDouble) {
        const { left, right } = heater as DoubleHeaterState;

        status.isEnabled = left?.enable;
        status.currentTemperature = left?.temperature?.current;
        status.targetTemperature = left?.temperature?.set;

        status.isEnabled2 = right?.enable;
        status.currentTemperature2 = right?.temperature?.current;
        status.targetTemperature2 = right?.temperature?.set;
      } else {
        const single = (heater as SingleHeaterState).single;

        status.isEnabled = single?.enable;
        status.currentTemperature = single?.temperature?.current;
        status.targetTemperature = single?.temperature?.set;
      }
    }

    // locked
    status.isLocked = state.childLock;

    return status;
  }

  // this logic is added on #38 (https://github.com/kyle-seongwoo-jun/homebridge-navien-smart/pull/38)
  // and split from parseStatusFrom() to make it more readable
  //
  // but i don't understand clearly why this logic is needed.
  adjustStatus(
    originalStatus: NavienDeviceStatus,
    targetTemperature: number,
    targetTemperature2: number,
    heatRange: { min: number; max: number; step: number },
  ): NavienDeviceStatus {
    const status = { ...originalStatus };

    // adjust temperatureSet when left is enabled/disabled
    if (status.isEnabled !== undefined) {
      if (status.isEnabled) {
        if (targetTemperature <= heatRange.min) {
          status.targetTemperature = heatRange.min + heatRange.step;
        }
      } else {
        if (targetTemperature > heatRange.min) {
          status.targetTemperature = heatRange.min;
        }
      }
    }

    // adjust isLeftEnabled when temperatureSet is changed
    if (status.targetTemperature !== undefined) {
      status.isEnabled = status.targetTemperature > heatRange.min;
    }

    // adjust temperatureSetRight when right is enabled/disabled
    if (status.isEnabled2 !== undefined) {
      if (status.isEnabled2) {
        if (targetTemperature2 <= heatRange.min) {
          status.targetTemperature2 = heatRange.min + heatRange.step;
        }
      } else {
        if (targetTemperature2 > heatRange.min) {
          status.targetTemperature2 = heatRange.min;
        }
      }
    }

    // adjust isRightEnabled when temperatureSetRight is changed
    if (status.targetTemperature2 !== undefined) {
      status.isEnabled2 = status.targetTemperature2 > heatRange.min;
    }

    return status;
  }
}

export class NavienDeviceStatusRepository {
  private readonly parser: NavienDeviceStatusParser;

  private _isConnected: boolean;
  private _isPowerOn: boolean;
  private _isEnabled: boolean;
  private _isEnabled2: boolean;
  private _currentTemperature: number | null;
  private _currentTemperature2: number | null;
  private _targetTemperature: number;
  private _targetTemperature2: number;
  private _isLocked: boolean;

  private readonly isPowerOnSubject: BehaviorSubject<boolean>;
  private readonly isEnabledSubject: BehaviorSubject<boolean>;
  private readonly isEnabled2Subject: BehaviorSubject<boolean>;
  private readonly currentTemperatureSubject: BehaviorSubject<number>;
  private readonly currentTemperature2Subject: BehaviorSubject<number>;
  private readonly targetTemperatureSubject: BehaviorSubject<number>;
  private readonly targetTemperature2Subject: BehaviorSubject<number>;
  private readonly isLockedSubject: BehaviorSubject<boolean>;
  private readonly subscription: Subscription;

  constructor(
    private readonly log: Logger,
    private readonly pubsub: AwsPubSub,
    public readonly device: NavienDevice,
  ) {
    const { heatRange } = this.device.functions;

    // initialize parser
    this.parser = new NavienDeviceStatusParser(this.device.isDouble);

    // initialize status
    // Please refer to the comments in the getter/setter.
    this._isConnected = false;
    this._isPowerOn = false;
    this._isEnabled = false;
    this._isEnabled2 = false;
    this._currentTemperature = null;
    this._currentTemperature2 = null;
    this._targetTemperature = heatRange.min;
    this._targetTemperature2 = heatRange.min;
    this._isLocked = false;

    this.isPowerOnSubject = new BehaviorSubject<boolean>(false);
    this.isEnabledSubject = new BehaviorSubject<boolean>(false);
    this.isEnabled2Subject = new BehaviorSubject<boolean>(false);
    this.currentTemperatureSubject = new BehaviorSubject<number>(heatRange.min);
    this.currentTemperature2Subject = new BehaviorSubject<number>(heatRange.min);
    this.targetTemperatureSubject = new BehaviorSubject<number>(heatRange.min);
    this.targetTemperature2Subject = new BehaviorSubject<number>(heatRange.min);
    this.isLockedSubject = new BehaviorSubject<boolean>(false);

    this.subscription = this.pubsub.deviceStatusChanges(this.device.id).subscribe((event) => {
      this.log.debug('[AWS PubSub] device status changed:', JSON.stringify(event));

      // parse status
      const state = event.payload.state.reported!;
      const originalStatus = this.parser.parseStatusFrom(state);
      const status = this.parser.adjustStatus(originalStatus, this._targetTemperature, this._targetTemperature2, heatRange);

      // log status
      if (!status.isConnected) {
        this.log.info('[AWS PubSub] device disconnected', {
          name: this.device.name,
        });
      } else {
        this.log.debug('[AWS PubSub] current status:', {
          name: this.device.name,
          ...status,
        });

        // log adjusted properties for debugging
        this.logAdjustedProperties(originalStatus, status);
      }

      // update status
      this._isConnected = status.isConnected;
      this.isPowerOn = status.isPowerOn ?? this._isPowerOn;
      this.isEnabled = status.isEnabled ?? this._isEnabled;
      this.isRightEnabled = status.isEnabled2 ?? this._isEnabled2;
      if (status.currentTemperature !== undefined) {
        this.currentTemperature = status.currentTemperature;
      }
      if (status.currentTemperature2 !== undefined) {
        this.rightCurrentTemperature = status.currentTemperature2;
      }
      this.targetTemperature = status.targetTemperature ?? this._targetTemperature;
      this.rightTargetTemperature = status.targetTemperature2 ?? this._targetTemperature2;
      this.isLocked = status.isLocked ?? this._isLocked;
    });
  }

  logAdjustedProperties(originalStatus: NavienDeviceStatus, status: NavienDeviceStatus) {
    const getJsonDiff = (obj1: NavienDeviceStatus, obj2: NavienDeviceStatus) => {
      const diff: Record<string, unknown> = {};

      Object.keys(obj1).forEach((key) => {
        if (JSON.stringify(obj1[key]) !== JSON.stringify(obj2[key])) {
          diff[key] = { original: obj1[key], adjusted: obj2[key] };
        }
      });

      Object.keys(obj2).forEach((key) => {
        if (!(key in obj1)) {
          diff[key] = { original: undefined, adjusted: obj2[key] };
        }
      });

      return diff;
    };

    const diff = getJsonDiff(originalStatus, status);
    if (Object.keys(diff).length > 0) {
      this.log.debug('[AWS PubSub] status adjusted:', { ...diff });
    }
  }

  /**
   * Returns true when the device is connected to the AWS IoT Service
   */
  get isConnected() {
    return this._isConnected;
  }

  /**
   * Returns true when the device is powered on(operationMode is ON)
   */
  get isPowerOn() {
    return this._isPowerOn;
  }

  set isPowerOn(value: boolean) {
    if (this._isPowerOn === value) {
      return;
    }
    this._isPowerOn = value;
    this.isPowerOnSubject.next(value);
  }

  /**
   * Returns true when the heater is enabled.
   * It may be true even when the device is not working(`isPowerOn` is false).
   */
  get isEnabled() {
    return this._isEnabled;
  }

  set isEnabled(value: boolean) {
    if (this._isEnabled === value) {
      return;
    }
    this._isEnabled = value;
    this.isEnabledSubject.next(value);
  }

  /**
   * Returns true when the left heater is enabled.
   * It may be true even when the device is not working(`isPowerOn` is false).
   * Alias of `isEnabled`.
   */
  get isLeftEnabled() {
    return this.isEnabled;
  }

  /**
   * Returns true when the right heater is enabled.
   * It may be true even when the device is not working(`isPowerOn` is false).
   * Always false for single heater.
   */
  get isRightEnabled() {
    return this._isEnabled2;
  }

  set isRightEnabled(value: boolean) {
    if (this._isEnabled2 === value) {
      return;
    }
    this._isEnabled2 = value;
    this.isEnabled2Subject.next(value);
  }

  /**
   * Returns true when the device is on(`isPowerOn` is true) but not working.
   * Only used for accessoryType HeaterCooler.
   * For double heater, it represents state of left heater.
   */
  get isIdle() {
    if (this._currentTemperature === null) {
      const { heatRange } = this.device.functions;
      return this._isPowerOn && this._targetTemperature === heatRange.min;
    }
    return this._isPowerOn && this._targetTemperature <= this._currentTemperature;
  }

  /**
   * Returns true when the device is on(`isPowerOn` is true) but not working.
   * Only used for accessoryType HeaterCooler.
   * Alias of `isIdle`.
   */
  get isLeftIdle() {
    return this.isIdle;
  }

  /**
   * Returns true when the device is on(`isPowerOn` is true) but not working.
   * Only used for accessoryType HeaterCooler.
   * Only used for double heater, it represents state of right heater.
   */
  get isRightIdle() {
    if (this._currentTemperature2 === null) {
      const { heatRange } = this.device.functions;
      return this._isPowerOn && this._targetTemperature2 === heatRange.min;
    }
    return this._isPowerOn && this._targetTemperature2 <= this._currentTemperature2;
  }

  /**
   * Returns current temperature of the heater.
   * If the device does not support current temperature, it returns `targetTemperature`.
   * For double heater, it represents state of left heater.
   */
  get currentTemperature() {
    return this._currentTemperature || this._targetTemperature;
  }

  set currentTemperature(value: number) {
    if (this._currentTemperature === value) {
      return;
    }
    this._currentTemperature = value;
    this.currentTemperatureSubject.next(value);
  }

  /**
   * Returns current temperature of the heater.
   * If the device does not support current temperature, it returns `leftTargetTemperature`.
   * Alias of `currentTemperature`.
   */
  get leftCurrentTemperature() {
    return this.currentTemperature;
  }

  /**
   * Returns current temperature of the heater.
   * If the device does not support current temperature, it returns `rightTargetTemperature`.
   * Only used for double heater, it represents state of right heater.
   */
  get rightCurrentTemperature() {
    return this._currentTemperature2 || this._targetTemperature2;
  }

  set rightCurrentTemperature(value: number) {
    if (this._currentTemperature2 === value) {
      return;
    }
    this._currentTemperature2 = value;
    this.currentTemperature2Subject.next(value);
  }

  /**
   * Returns target temperature of the heater.
   * For double heater, it represents state of left heater.
   */
  get targetTemperature() {
    return this._targetTemperature;
  }

  set targetTemperature(value: number) {
    if (this._targetTemperature === value) {
      return;
    }
    this._targetTemperature = value;
    this.targetTemperatureSubject.next(value);
    if (this._currentTemperature === null) {
      this.currentTemperatureSubject.next(value);
    }
  }

  /**
   * Returns target temperature of the heater.
   * Alias of `targetTemperature`.
   */
  get leftTargetTemperature() {
    return this.targetTemperature;
  }

  /**
   * Returns target temperature of the heater.
   * Only used for double heater, it represents state of right heater.
   */
  get rightTargetTemperature() {
    return this._targetTemperature2;
  }

  set rightTargetTemperature(value: number) {
    if (this._targetTemperature2 === value) {
      return;
    }
    this._targetTemperature2 = value;
    this.targetTemperature2Subject.next(value);
    if (this._currentTemperature2 === null) {
      this.currentTemperature2Subject.next(value);
    }
  }

  /**
   * Returns true when the child lock is enabled.
   */
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

  get isPowerOnChanges() {
    return this.isPowerOnSubject.asObservable();
  }

  get isLeftEnabledChanges() {
    return this.isEnabledSubject.asObservable();
  }

  get isRightEnabledChanges() {
    return this.isEnabled2Subject.asObservable();
  }

  get currentTemperatureChanges() {
    return this.currentTemperatureSubject.asObservable();
  }

  get leftCurrentTemperatureChanges() {
    return this.currentTemperatureChanges;
  }

  get rightCurrentTemperatureChanges() {
    return this.currentTemperature2Subject.asObservable();
  }

  get targetTemperatureChanges() {
    return this.targetTemperatureSubject.asObservable();
  }

  get leftTargetTemperatureChanges() {
    return this.targetTemperatureChanges;
  }

  get rightTargetTemperatureChanges() {
    return this.targetTemperature2Subject.asObservable();
  }

  get lockedChanges() {
    return this.isLockedSubject.asObservable();
  }

  isZoneEnabled(zone: HeatingZone): boolean {
    switch (zone) {
      case 'single':
      case 'left':
        return this.isLeftEnabled;
      case 'right':
        return this.isRightEnabled;
    }
  }

  getZoneEnables(zone: 'left' | 'right'): [boolean, boolean] {
    const { isLeftEnabled, isRightEnabled } = this;

    switch (zone) {
      case 'left':
        return [isLeftEnabled, isRightEnabled];
      case 'right':
        return [isRightEnabled, isLeftEnabled];
    }
  }

  isZoneIdle(zone?: HeatingZone): boolean {
    switch (zone) {
      case 'single':
      case undefined: // unified control
        return this.isIdle;
      case 'left':
        return this.isLeftIdle;
      case 'right':
        return this.isRightIdle;
    }
  }

  getCurrentTemperature(zone?: HeatingZone): number {
    switch (zone) {
      case 'single':
      case undefined: // unified control
        return this.currentTemperature;
      case 'left':
        return this.leftCurrentTemperature;
      case 'right':
        return this.rightCurrentTemperature;
    }
  }

  getTargetTemperature(zone?: HeatingZone): number {
    switch (zone) {
      case 'single':
      case undefined: // unified control
        return this.targetTemperature;
      case 'left':
        return this.leftTargetTemperature;
      case 'right':
        return this.rightTargetTemperature;
    }
  }

  dispose() {
    this.subscription.unsubscribe();
    this.isPowerOnSubject.complete();
    this.isEnabledSubject.complete();
    this.isEnabled2Subject.complete();
    this.currentTemperatureSubject.complete();
    this.currentTemperature2Subject.complete();
    this.targetTemperatureSubject.complete();
    this.targetTemperature2Subject.complete();
    this.isLockedSubject.complete();
  }
}
