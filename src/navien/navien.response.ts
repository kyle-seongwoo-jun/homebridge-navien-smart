import { AuthInfo, Device } from './navien.model';

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

export type RefreshTokenResponse = NavienResponse<{ authInfo: AuthInfo }>;

export type DevicesResponse = NavienResponse<{ devices: Device[] }>;