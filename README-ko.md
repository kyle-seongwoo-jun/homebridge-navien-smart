<p align="center">

<img src="https://github.com/homebridge/branding/raw/latest/logos/homebridge-gradient-named.png" width="150">

</p>

<span align="center">

# Homebridge Navien Smart

</span>

[🇺🇸 English Version](README.md) | **[🇰🇷 한국어 버전](README-ko.md)**

## 둘러보기

나비엔 스마트를 통해 나비엔 기기를 제어하는 플러그인.

"나비엔 스마트" 시스템과 상호 작용하는 플러그인으로, 나비엔 기기를 제어할 수 있습니다. 이 플러그인에서 사용된 API는 공식적이지 않으며, "나비엔 스마트" 모바일 앱에서 리버싱을 통해 얻었습니다.

### ⚠️ 경고

이 플러그인은 `나비엔 EME520 (퀸 사이즈)` 모델에서만 테스트되었습니다. 다른 모델에서는 작동하지 않을 수 있습니다. 다른 모델을 사용하는 경우 지원 요청 이슈를 열어주세요.

자세한 정보는 [구현 상태](#구현-상태)를 참조하세요.

## 설치

```shell
npm i -g homebridge-navien-smart
```

# 설정

```json
{
    "authMode": "account",
    "username": "<navien-smart-username>",
    "password": "<navien-smart-password>",
    "platform": "NavienSmart"
}
```

```json
{
    "authMode": "token",
    "username": "<navien-smart-username>",
    "refreshToken": "<navien-api-refresh-token>",
    "accountSeq": 12345678,
    "platform": "NavienSmart"
}
```

| *키* | *설명* |
| --- | --- |
| `authMode` | 필수. `token`과 `account` 중 하나를 선택할 수 있습니다. |
| `username` | 필수. 나비엔 스마트 계정 |
| `password` | `authMode`가 `account`인 경우 필수. 나비엔 스마트 비밀번호 |
| `refreshToken` | `authMode`가 `token`인 경우 필수. `navien` CLI로 얻을 수 있습니다. |
| `accountSeq` | `authMode`가 `token`인 경우 필수. `navien` CLI로 얻을 수 있습니다. |
| `platform` | 항상 `NavienSmart` |

비밀번호를 설정 파일에 넣고 싶지 않은 경우 `authMode`를 `token`으로 설정하고 대신 `refreshToken`과 `accountSeq`를 사용할 수 있습니다.

해당 값들은 `navien` CLI로 얻을 수 있습니다. 자세한 내용은 [CLI 사용방법](#cli-사용방법)을 참조하세요.

## 구현 상태

| *장치*       | *구현* | *상태* | *제어* |
|----------------| --- | --- | --- |
| 보일러         | 🚫 | 🚫 | 🚫 |
| EME 모델     | ✔️ | ✔️ | ✔️ |
| EQM 모델     | 🚫 | 🚫 | 🚫 |

다른 장치 지원을 원하시면 이슈 요청을 열어주세요.

## CLI 사용방법

```shell
$ navien
Usage: navien <username> <password>
```

```shell
$ npm install -g homebridge-navien-smart
$ navien <your-username> <your-password>
Logging in with username: <your-username>, password: <your-password>
refreshToken: XXXXXXXXXXX.XXXXXXXXX.XXXXXXXXX
accountSeq: 12345678
```

`refreshToken`과 `accountSeq`를 복사하여 설정 파일에 붙여넣으면 됩니다.
