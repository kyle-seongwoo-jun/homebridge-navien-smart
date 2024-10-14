export interface TokenAuthInfo {
    accessToken: string;
    authenticationExpiresIn: number; // seconds
}

export interface Login2Data {
    userInfo: UserInfo;
    currentHomeSeq: number | null; // seems to be always null
    home: Home[];
    authInfo: AwsAuthInfo;
    notice: never[];
}

export interface UserInfo {
    userSeq: number;
    userId: string;
    nickname: string | null; // seems to be always null
    // 메뉴 - 회원정보 변경 - 부가정보
    gender: 'M' | 'F' | null; // M: 남성, F: 여성
    residentialType: number | null; // 1: 아파트, 2: 원룸, 3: 오피스텔, 4: 빌라, 5: 단독주택, 6: 사무공간, 7: 상업공간, 8: 기타
}

export interface Home {
    homeSeq: number;
    nickname: string;
    mainUser: Omit<UserInfo, 'gender' | 'residentialType'>;
    userType: string;
    users: number[]; // userSeq
    devices: number[]; // deviceSeq
    regionCode: number | null; // region code for weather
    registerAt: number; // unix timestamp in milliseconds
}

export interface AwsAuthInfo {
    accessKeyId: string;
    secretKey: string;
    sessionToken: string;
    authorizationExpiresIn: number; // seconds
}
