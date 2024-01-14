import { Device, Login2Data, TokenAuthInfo } from './navien.model';

export interface LoginResponse {
    loginId: string;
    clientId: string;
    accessToken: string;
    authenticationExpiresIn: number;
    userSeq: number;
    refreshToken: string;
}

export interface NavienResponse<T> {
    code: number;
    msg: string;
    data: T;
}

export type RefreshTokenResponse = NavienResponse<{ authInfo: TokenAuthInfo }>;

export type Login2Response = NavienResponse<Login2Data>;

export type DevicesResponse = NavienResponse<{ devices: Device[] }>;