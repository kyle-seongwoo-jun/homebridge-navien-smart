import { Device } from './interfaces/index.js';
import { NavienDevice } from './navien.device.js';

function createDevice(functions: Record<string, unknown>) {
  return new NavienDevice({
    deviceId: 'test-device',
    modelName: 'test-model',
    Properties: {
      nickName: {
        mainItem: 'test',
      },
      registry: {
        attributes: {
          functions,
        },
      },
    },
  } as unknown as Device);
}

describe('NavienDevice', () => {
  it('keeps the existing heating range behavior for heat-only devices', () => {
    const device = createDevice({
      heatControl: {
        unit: '0.5',
        rangeMin: 28,
        rangeMax: 45,
      },
    });

    expect(device.functions).toEqual({
      heatRange: {
        min: 27.5,
        max: 45,
        step: 0.5,
      },
      coolRange: undefined,
    });
  });

  it('exposes the cooling range reported by four-season devices', () => {
    const device = createDevice({
      heatControl: {
        unit: '0.5',
        rangeMin: 28,
        rangeMax: 45,
      },
      coolControl: {
        unit: '0.5',
        rangeMin: 20,
        rangeMax: 35,
      },
    });

    expect(device.functions.coolRange).toEqual({
      min: 20,
      max: 35,
      step: 0.5,
    });
  });
});
