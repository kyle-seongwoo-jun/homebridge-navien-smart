import { Logger } from 'homebridge';
import { BehaviorSubject, Subscription } from 'rxjs';

import { DoubleHeaterState, NavienReportedState, OperationMode, SingleHeaterState } from '../aws/interfaces/index.js';
import { AwsPubSub } from '../aws/pubsub.js';
import { HeatingZone } from './interfaces/index.js';
import { NavienDevice } from './navien.device.js';

interface NavienDeviceStatus {
  isConnected: boolean;
  isPowerOn?: boolean;
  isLeftEnabled?: boolean;
  isRightEnabled?: boolean;
  temperatureCurrent?: number;
  temperatureSet?: number;
  temperatureCurrentRight?: number;
  temperatureSetRight?: number;
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

        status.isLeftEnabled = left?.enable;
        status.temperatureCurrent = left?.temperature?.current;
        status.temperatureSet = left?.temperature?.set;

        status.isRightEnabled = right?.enable;
        status.temperatureCurrentRight = right?.temperature?.current;
        status.temperatureSetRight = right?.temperature?.set;
      } else {
        const single = (heater as SingleHeaterState).single;

        status.isLeftEnabled = single?.enable;
        status.temperatureCurrent = single?.temperature?.current;
        status.temperatureSet = single?.temperature?.set;
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
    temperatureSet: number,
    temperatureSetRight: number,
    heatRange: { min: number; max: number; step: number },
  ): NavienDeviceStatus {
    const status = { ...originalStatus };

    // adjust temperatureSet when left is enabled/disabled
    if (status.isLeftEnabled !== undefined) {
      if (status.isLeftEnabled) {
        if (temperatureSet <= heatRange.min) {
          status.temperatureSet = heatRange.min + heatRange.step;
        }
      } else {
        if (temperatureSet > heatRange.min) {
          status.temperatureSet = heatRange.min;
        }
      }
    }

    // adjust isLeftEnabled when temperatureSet is changed
    if (status.temperatureSet !== undefined) {
      status.isLeftEnabled = status.temperatureSet > heatRange.min;
    }

    // adjust temperatureSetRight when right is enabled/disabled
    if (status.isRightEnabled !== undefined) {
      if (status.isRightEnabled) {
        if (temperatureSetRight <= heatRange.min) {
          status.temperatureSetRight = heatRange.min + heatRange.step;
        }
      } else {
        if (temperatureSetRight > heatRange.min) {
          status.temperatureSetRight = heatRange.min;
        }
      }
    }

    // adjust isRightEnabled when temperatureSetRight is changed
    if (status.temperatureSetRight !== undefined) {
      status.isRightEnabled = status.temperatureSetRight > heatRange.min;
    }

    return status;
  }
}

export class NavienDeviceStatusRepository {
  private readonly parser: NavienDeviceStatusParser;

  private _isConnected: boolean;
  private _isPowerOn: boolean;
  private _isLeftEnabled: boolean;
  private _isRightEnabled: boolean;
  private _temperatureCurrent: number | null;
  private _temperatureSet: number;
  private _temperatureCurrentRight: number | null;
  private _temperatureSetRight: number;
  private _isLocked: boolean;

  private readonly isPowerOnSubject: BehaviorSubject<boolean>;
  private readonly isLeftEnabledSubject: BehaviorSubject<boolean>;
  private readonly isRightEnabledSubject: BehaviorSubject<boolean>;
  private readonly temperatureCurrentSubject: BehaviorSubject<number>;
  private readonly temperatureSetSubject: BehaviorSubject<number>;
  private readonly temperatureCurrentRightSubject: BehaviorSubject<number>;
  private readonly temperatureSetRightSubject: BehaviorSubject<number>;
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
    this._isLeftEnabled = false;
    this._isRightEnabled = false;
    this._temperatureCurrent = null;
    this._temperatureSet = heatRange.min;
    this._temperatureCurrentRight = null;
    this._temperatureSetRight = heatRange.min;
    this._isLocked = false;

    this.isPowerOnSubject = new BehaviorSubject<boolean>(false);
    this.isLeftEnabledSubject = new BehaviorSubject<boolean>(false);
    this.isRightEnabledSubject = new BehaviorSubject<boolean>(false);
    this.temperatureCurrentSubject = new BehaviorSubject<number>(heatRange.min);
    this.temperatureSetSubject = new BehaviorSubject<number>(heatRange.min);
    this.temperatureCurrentRightSubject = new BehaviorSubject<number>(heatRange.min);
    this.temperatureSetRightSubject = new BehaviorSubject<number>(heatRange.min);
    this.isLockedSubject = new BehaviorSubject<boolean>(false);

    this.subscription = this.pubsub.deviceStatusChanges(this.device.id).subscribe((event) => {
      this.log.debug('[AWS PubSub] device status changed:', JSON.stringify(event));

      // parse status
      const state = event.payload.state.reported!;
      const originalStatus = this.parser.parseStatusFrom(state);
      const status = this.parser.adjustStatus(originalStatus, this._temperatureSet, this._temperatureSetRight, heatRange);

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
      this.isLeftEnabled = status.isLeftEnabled ?? this._isLeftEnabled;
      this.isRightEnabled = status.isRightEnabled ?? this._isRightEnabled;
      if (status.temperatureCurrent !== undefined) {
        this.temperatureCurrent = status.temperatureCurrent;
      }
      if (status.temperatureCurrentRight !== undefined) {
        this.temperatureCurrentRight = status.temperatureCurrentRight;
      }
      this.temperatureSet = status.temperatureSet ?? this._temperatureSet;
      this.temperatureSetRight = status.temperatureSetRight ?? this._temperatureSetRight;
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
   * isConnected: true when the device is connected to the AWS IoT Service
   */
  get isConnected() {
    return this._isConnected;
  }

  /**
   * isPowerOn: true when the device is powered on(operationMode is ON)
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
   * isLeftEnabled: true when the left heater is enabled.
   * It may be true even when the device is not working(`isPowerOn` is false).
   * Always false for single heater.
   */
  get isLeftEnabled() {
    return this._isLeftEnabled;
  }

  set isLeftEnabled(value: boolean) {
    if (this._isLeftEnabled === value) {
      return;
    }
    this._isLeftEnabled = value;
    this.isLeftEnabledSubject.next(value);
  }

  /**
   * isRightEnabled: true when the right heater is enabled.
   * It may be true even when the device is not working(`isPowerOn` is false).
   * Always false for single heater.
   */
  get isRightEnabled() {
    return this._isRightEnabled;
  }

  set isRightEnabled(value: boolean) {
    if (this._isRightEnabled === value) {
      return;
    }
    this._isRightEnabled = value;
    this.isRightEnabledSubject.next(value);
  }

  /**
   * isIdle: true when the device on(`isPowerOn` is true) but not working.
   * Only used for accessoryType HeaterCooler.
   * For double heater, it represents state of left heater.
   */
  get isIdle() {
    if (this._temperatureCurrent === null) {
      const { heatRange } = this.device.functions;
      return this._isPowerOn && this._temperatureSet === heatRange.min;
    }
    return this._isPowerOn && this._temperatureSet <= this._temperatureCurrent;
  }

  /**
   * isRightIdle: true when the device on(`isPowerOn` is true) but not working.
   * Only used for accessoryType HeaterCooler.
   * Only used for double heater, it represents state of right heater.
   */
  get isRightIdle() {
    if (this._temperatureCurrentRight === null) {
      const { heatRange } = this.device.functions;
      return this._isPowerOn && this._temperatureSetRight === heatRange.min;
    }
    return this._isPowerOn && this._temperatureSetRight <= this._temperatureCurrentRight;
  }

  /**
   * temperatureCurrent: current temperature of the heater.
   * If the device does not support current temperature, it returns `temperatureSet`.
   * For double heater, it represents state of left heater.
   */
  get temperatureCurrent() {
    return this._temperatureCurrent || this._temperatureSet;
  }

  set temperatureCurrent(value: number) {
    if (this._temperatureCurrent === value) {
      return;
    }
    this._temperatureCurrent = value;
    this.temperatureCurrentSubject.next(value);
  }

  /**
   * temperatureSet: target temperature of the heater.
   * For double heater, it represents state of left heater.
   */
  get temperatureSet() {
    return this._temperatureSet;
  }

  set temperatureSet(value: number) {
    if (this._temperatureSet === value) {
      return;
    }
    this._temperatureSet = value;
    this.temperatureSetSubject.next(value);
    if (this._temperatureCurrent === null) {
      this.temperatureCurrentSubject.next(value);
    }
  }

  /**
   * temperatureCurrentRight: current temperature of the heater.
   * If the device does not support current temperature, it returns `temperatureSetRight`.
   * Only used for double heater, it represents state of right heater.
   */
  get temperatureCurrentRight() {
    return this._temperatureCurrentRight || this._temperatureSetRight;
  }

  set temperatureCurrentRight(value: number) {
    if (this._temperatureCurrentRight === value) {
      return;
    }
    this._temperatureCurrentRight = value;
    this.temperatureCurrentRightSubject.next(value);
  }

  /**
   * temperatureSetRight: target temperature of the heater.
   * Only used for double heater, it represents state of right heater.
   */
  get temperatureSetRight() {
    return this._temperatureSetRight;
  }

  set temperatureSetRight(value: number) {
    if (this._temperatureSetRight === value) {
      return;
    }
    this._temperatureSetRight = value;
    this.temperatureSetRightSubject.next(value);
    if (this._temperatureCurrentRight === null) {
      this.temperatureCurrentRightSubject.next(value);
    }
  }

  /*
   * isLocked: true when the child lock is enabled.
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
    return this.isLeftEnabledSubject.asObservable();
  }

  get isRightEnabledChanges() {
    return this.isRightEnabledSubject.asObservable();
  }

  get temperatureCurrentChanges() {
    return this.temperatureCurrentSubject.asObservable();
  }

  get temperatureSetChanges() {
    return this.temperatureSetSubject.asObservable();
  }

  get temperatureCurrentRightChanges() {
    return this.temperatureCurrentRightSubject.asObservable();
  }

  get temperatureSetRightChanges() {
    return this.temperatureSetRightSubject.asObservable();
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
      case 'left':
      case undefined: // unified control
        return this.isIdle;
      case 'right':
        return this.isRightIdle;
    }
  }

  getCurrentTemperature(zone?: HeatingZone): number {
    switch (zone) {
      case 'single':
      case 'left':
      case undefined: // unified control
        return this.temperatureCurrent;
      case 'right':
        return this.temperatureCurrentRight;
    }
  }

  getTargetTemperature(zone?: HeatingZone): number {
    switch (zone) {
      case 'single':
      case 'left':
      case undefined: // unified control
        return this.temperatureSet;
      case 'right':
        return this.temperatureSetRight;
    }
  }

  dispose() {
    this.subscription.unsubscribe();
    this.isPowerOnSubject.complete();
    this.isLeftEnabledSubject.complete();
    this.isRightEnabledSubject.complete();
    this.temperatureCurrentSubject.complete();
    this.temperatureSetSubject.complete();
    this.temperatureCurrentRightSubject.complete();
    this.temperatureSetRightSubject.complete();
    this.isLockedSubject.complete();
  }
}
