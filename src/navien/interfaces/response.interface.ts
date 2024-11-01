import { Device } from './device.interface';
import { TokenAuthInfo, TokenLoginData } from './login.interface';

export interface LoginResponse {
    loginId: string;
    clientId: string;
    accessToken: string;
    authenticationExpiresIn: number; // milliseconds
    userSeq: number;
    refreshToken: string;
}

export interface NavienResponse<T> {
    code: number;
    msg: string;
    data?: T;
}

export type CommonResponse = NavienResponse<never>;

export type RefreshTokenResponse = NavienResponse<{ authInfo: TokenAuthInfo }>;

export type TokenLoginResponse = NavienResponse<TokenLoginData>;

export type DevicesResponse = NavienResponse<{ devices: Device[] }>;

export enum ResponseCode {
    SUCCESS = 200,
    COMMON_BAD_REQUEST = 400,
    COMMON_NOT_AUTHORIZED = 404,
    COMMON_TOKEN_EXPIRED = 407,
}
