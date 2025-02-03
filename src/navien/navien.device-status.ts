import { Logger } from 'homebridge';
import { BehaviorSubject, Subscription } from 'rxjs';

import { DoubleHeaterState, OperationMode, SingleHeaterState } from '../aws/interfaces/index.js';
import { AwsPubSub } from '../aws/pubsub.js';
import { HeatingZone } from './interfaces/index.js';
import { NavienDevice } from './navien.device.js';

export class NavienDeviceStatusRepository {
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

      const { heatRange } = this.device.functions;
      const state = event.payload.state.reported!;

      // state has connected property only when device is disconnected
      if (!state.connected) {
        this.log.info('[AWS PubSub] device disconnected', { name: this.device.name });
        return;
      } else {
        this._isConnected = true;
      }

      // status update
      if ('heater' in state) {
        const heater = state.heater!;
        if (this.device.isDouble) {
          const left = (heater as DoubleHeaterState).left;
          const right = (heater as DoubleHeaterState).right;
          if (left !== undefined) {
            const temperatureLeft = left?.temperature;
            if ('enable' in left) {
              this.isLeftEnabled = left.enable!;
              // adjust temperatureSet when left is enabled/disabled
              if (left.enable) {
                if (this.temperatureSet <= heatRange.min) {
                  this.temperatureSet = heatRange.min + heatRange.step;
                }
              } else {
                if (this.temperatureSet > heatRange.min) {
                  this.temperatureSet = heatRange.min;
                }
              }
            }
            if (temperatureLeft !== undefined) {
              if ('current' in temperatureLeft) {
                this.temperatureCurrent = temperatureLeft.current!;
              }
              if ('set' in temperatureLeft) {
                this.temperatureSet = temperatureLeft.set!;
                // adjust isLeftEnabled when temperatureSet is changed
                if (temperatureLeft.set! > heatRange.min) {
                  this.isLeftEnabled = true;
                } else {
                  this.isLeftEnabled = false;
                }
              }
            }
          }
          if (right !== undefined) {
            const temperatureRight = right?.temperature;
            if ('enable' in right) {
              this.isRightEnabled = right.enable!;
              // adjust temperatureSetRight when right is enabled/disabled
              if (right.enable) {
                if (this.temperatureSetRight <= heatRange.min) {
                  this.temperatureSetRight = heatRange.min + heatRange.step;
                }
              } else {
                if (this.temperatureSetRight > heatRange.min) {
                  this.temperatureSetRight = heatRange.min;
                }
              }
            }
            if (temperatureRight !== undefined) {
              if ('current' in temperatureRight) {
                this.temperatureCurrentRight = temperatureRight.current!;
              }
              if ('set' in temperatureRight) {
                this.temperatureSetRight = temperatureRight.set!;
                // adjust isRightEnabled when temperatureSetRight is changed
                if (temperatureRight.set! > heatRange.min) {
                  this.isRightEnabled = true;
                } else {
                  this.isRightEnabled = false;
                }
              }
            }
          }
        } else {
          const single = (heater as SingleHeaterState).single;
          if (single?.temperature !== undefined) {
            // isLeftEnabled, isRightEnabled are always false for single heater
            const temperature = single?.temperature;
            if ('current' in temperature) {
              this.temperatureCurrent = temperature.current!;
            }
            if ('set' in temperature) {
              this.temperatureSet = temperature.set!;
            }
          }
        }
      }
      if ('childLock' in state) {
        this.isLocked = state.childLock!;
      }
      if ('operationMode' in state) {
        this.isPowerOn = (state.operationMode === OperationMode.ON);
      }

      // log current status
      this.log.debug('[AWS PubSub] current status:', {
        name: this.device.name,
        isPowerOn: this.isPowerOn,
        isLeftEnabled: this.isLeftEnabled,
        isRightEnabled: this.isRightEnabled,
        temperatureCurrent: this.temperatureCurrent,
        temperatureSet: this.temperatureSet,
        temperatureRightCurrent: this.temperatureCurrentRight,
        temperatureRightSet: this.temperatureSetRight,
        isLocked: this.isLocked,
      });
    });
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

  getCurrentTemperature(zone?: HeatingZone): number {
    switch (zone) {
      case 'single':
      case 'left':
      case undefined:
        return this.temperatureCurrent;
      case 'right':
        return this.temperatureCurrentRight;
    }
  }

  setCurrentTemperature(value: number, zone?: HeatingZone) {
    switch (zone) {
      case 'single':
      case 'left':
      case undefined:
        this.temperatureCurrent = value;
        break;
      case 'right':
        this.temperatureCurrentRight = value;
        break;
    }
  }

  getTargetTemperature(zone?: HeatingZone): number {
    switch (zone) {
      case 'single':
      case 'left':
      case undefined:
        return this.temperatureSet;
      case 'right':
        return this.temperatureSetRight;
    }
  }

  setTargetTemperature(value: number, zone?: HeatingZone) {
    switch (zone) {
      case 'single':
      case 'left':
      case undefined:
        this.temperatureSet = value;
        break;
      case 'right':
        this.temperatureSetRight = value;
        break;
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
