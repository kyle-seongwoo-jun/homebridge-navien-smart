
export type NavienDeviceEvent = DeviceShadowServiceDocument<NavienDesiredState, NavienReportedState>;

// https://docs.aws.amazon.com/iot/latest/developerguide/device-shadow-document.html#device-shadow-example-response-json
interface DeviceShadowServiceDocument<TDesired, TReported> {
    topic: string;
    serviceCode: number;
    // /accepted
    payload: Payload<TDesired, TReported>;
    // /documents
    // payload: {
    //     previous: Payload<TDesired, TReported>;
    //     current: Payload<TDesired, TReported>;
    // };
}

interface Payload<TDesired, TReported> {
    state: State<TDesired, TReported>;
    metadata: Record<string, unknown>;
    version: number;
    timestamp: number; // epoch time in milliseconds
}

interface State<TDesired, TReported> {
    desired: TDesired;
    reported?: TReported;
}

export interface NavienDesiredState {
    event: null;
    operationMode: OperationMode;
    childLock: boolean;
    heater: HeaterState;
}

export interface NavienReportedState {
    info: DeviceInfo;
    connected: boolean;
    errorCode?: number;
    operationMode?: OperationMode;
    heater?: HeaterState;
    childLock?: boolean;
    schedule?: ScheduleState;
}

export enum OperationMode {
    OFF = 0,
    ON = 1,
}

export type HeaterState = SingleHeaterState | DoubleHeaterState;

export interface SingleHeaterState {
    single?: HeaterItemState;
}

export interface DoubleHeaterState {
    left?: HeaterItemState;
    right?: HeaterItemState;
}

export interface HeaterItemState {
    enable?: boolean;
    temperature: {
        // celcius
        current?: number;
        set?: number;
    };
}

export interface DeviceInfo {
    deviceId: string;
    modelCode: number;
    countryCode: number;
}

export interface ScheduleState {
    weekly: {
        active: boolean;
    };
}
