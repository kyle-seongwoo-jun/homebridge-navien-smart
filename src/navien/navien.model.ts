export interface LoginResponse {
  loginId: string;
  clientId: string;
  accessToken: string;
  authenticationExpiresIn: number;
  userSeq: number;
  refreshToken: string;
}

export interface Device {
    deviceSeq: number;
    serviceCode: number;
    deviceId: string;
    modelCode: string;
    mqttTopicKey: string;
    registerBy: string;
    registerAt: Date;
    Properties: Properties;
    icon: number;
    regionCode: number;
    lastModifyAt: Date;
    connected: number;
    modelName: string;
    orderNo: number;
}

export interface Properties {
    nickName: PropertiesNickName;
    registry: Registry;
}

export interface PropertiesNickName {
    mainItem: string;
    side: Side;
}

export interface Side {
    left: string;
    right: string;
}

export interface Registry {
    attributes: Attributes;
}

export interface Attributes {
    country: string;
    userInfo: UserInfo;
    wifi: Wifi;
    functions: Functions;
    lastModifyAt: Date;
    model: string;
    modelType: string;
    deviceId: string;
    registerAt: Date;
    mcu: Mcu;
    network: Network;
}

export interface Functions {
    powerCtrl: boolean;
    sleepMode: SleepMode;
    schedule: Schedule;
    lockMode: boolean;
    powerSaving: boolean;
    heatControl: HeatControl;
}

export interface HeatControl {
    unit: string;
    safeValue: number;
    rangeMax: number;
    rangeMin: number;
    enableSafe: boolean;
}

export interface Schedule {
    oneTime: boolean;
    personal: boolean;
    weekly: boolean;
}

export interface SleepMode {
    exitAlarm: boolean;
    rangeMax: number;
    enable: boolean;
    rangeMin: number;
    sensor: boolean;
    Kaist: boolean;
    durations: number[];
}

export interface Mcu {
    matType: number;
    version: McuVersion;
    countryCode: number;
    modelCode: number;
    capacity: number;
}

export interface McuVersion {
    desired: Current;
    available: Available;
    current: Current;
}

export interface Available {
    crc16: number;
    flag: number;
    major: number;
    minor: number;
    size: number;
    build: number;
    blockTotal: number;
    blockGet: number;
}

export interface Current {
    major: number;
    minor: number;
    build: number;
    accept?: boolean;
}

export interface Network {
    accessPoint: AccessPoint;
    server: Server;
}

export interface AccessPoint {
    ssid: string;
    mac: string;
}

export interface Server {
    endpoint: string;
}

export interface UserInfo {
    userId: string;
    nickName: UserInfoNickName;
}

export interface UserInfoNickName {
    left: string;
    main: string;
    right: string;
}

export interface Wifi {
    localIp: string;
    version: WifiVersion;
}

export interface WifiVersion {
    current: Current;
}
