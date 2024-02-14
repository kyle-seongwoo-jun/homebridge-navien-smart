export interface DeviceEvent {
    state: State;
    metadata: Record<string, unknown>;
    version: number;
    timestamp: number; // epoch time in milliseconds
}

export interface State {
    desired: StateDesired;
    reported?: StateReported;
}

export interface StateDesired {
    event: null;
    operationMode: OperationMode;
    childLock: boolean;
    heater: HeaterState;
}

export interface StateReported {
    info: DeviceInfo;
    connected: boolean;
    errorCode: number;
    operationMode: OperationMode;
    heater: HeaterState;
    childLock: boolean;
    schedule: ScheduleState;
}

export enum OperationMode {
    OFF = 0,
    ON = 1,
}

export interface HeaterState {
    left: HeaterItemState;
    right: HeaterItemState;
}

export interface HeaterItemState {
    enable: boolean;
    temperature: {
        set: number; // celcius
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
