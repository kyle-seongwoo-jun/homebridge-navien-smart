/* eslint-disable @typescript-eslint/no-unsafe-declaration-merging */
import { Device } from './interfaces/index.js';

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface NavienDevice extends Device { }

export class NavienDevice {
  constructor(json: Device) {
    Object.assign(this, json);
  }

  get id() {
    return this.deviceId;
  }

  get name() {
    return this.Properties.nickName.mainItem;
  }

  get isDouble() {
    /*
     * XXX(junbongwe): There is no explicit field or way to query whether a device is double or single.
     * For now, just check if there exists field `side` in `Properties.nickName`.
     */
    return this.Properties.nickName.side !== undefined;
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
}
