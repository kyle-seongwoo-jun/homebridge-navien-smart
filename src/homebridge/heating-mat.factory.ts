import { NavienHomebridgePlatform, NavienPlatformAccessory } from '../platform.js';
import { DoubleHeatingMat } from './double-heating-mat.device.js';
import { SingleHeatingMat } from './single-heating-mat.device.js';

export class HeatingMatFactory {
  static create(
    platform: NavienHomebridgePlatform,
    accessory: NavienPlatformAccessory,
  ) {
    const { config } = platform;
    const { device } = accessory.context;

    const isDoubleHeatingMat = device.isDouble && config.separateControl;
    if (isDoubleHeatingMat) {
      return new DoubleHeatingMat(platform, accessory);
    } else {
      return new SingleHeatingMat(platform, accessory);
    }
  }
}
