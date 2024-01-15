export interface TokenAuthInfo {
    accessToken: string;
    authenticationExpiresIn: number; // seconds
}

export interface Login2Data {
    userSeq: number;
    userType: string;
    familySeq: number;
    authInfo: AwsAuthInfo;
    notice: never[];
}

export interface AwsAuthInfo {
    accessKeyId: string;
    secretKey: string;
    sessionToken: string;
    authorizationExpiresIn: number; // seconds
}
