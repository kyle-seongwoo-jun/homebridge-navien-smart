<p align="center">

<img src="https://github.com/homebridge/branding/raw/latest/logos/homebridge-gradient-named.png" width="150">

</p>

<span align="center">

# Homebridge Navien Smart

</span>

**[🇺🇸 English Version](README.md)** | [🇰🇷 한국어 버전](README-ko.md)

## Overview

![demo](https://raw.githubusercontent.com/kyle-seongwoo-jun/homebridge-navien-smart/latest/docs/demo.jpg)

Homebridge plugin to control Navien devices via Navien Smart.

A plugin for interacting with the "Navien Smart" system, which can control Navien devices. API used in this plugin is not official, I reversed from their "Navien Smart" mobile app.

### ⚠️ Warning

This plugin is only tested with `Navien EME520 (Queen size)` model. It may not work with other models. If you have a different model, please open an issue to support your model.

See [Implementation Status](#implementation-status) for more information.

## Installation

```shell
npm i -g homebridge-navien-smart
```

# Configuration

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

| *Key* | *Description* |
| --- | --- |
| `authMode` | Required. You can choose between `token` and `account` |
| `username` | Required. Navien Smart account |
| `password` | Required if `authMode` = `account`. Navien Smart password |
| `refreshToken` | Required if `authMode` = `token`. You can get it with `navien` cli. |
| `accountSeq` | Required if `authMode` = `token`. You can get it with `navien` cli. |
| `platform` | value always `NavienSmart` |

If you don't want to put your password in the config, you can use `authMode` = `token` and use `refreshToken` and `accountSeq` instead.

You can get them with `navien` cli. See [CLI Usage](#cli-usage).

## Implementation Status

| *Device*       | *Implementation* | *Status* | *Control* |
|----------------| --- | --- | --- |
| Boiler         | 🚫 | 🚫 | 🚫 |
| EME Models     | ✔️ | ✔️ | ✔️ |
| EQM Models     | 🚫 | 🚫 | 🚫 |

for more device support please open issue request.

## CLI Usage

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

You can copy and paste `refreshToken` and `accountSeq` to your config.

## Demo

### Siri (Voice Control)

[![siri demo](https://img.youtube.com/vi/FpLxOSHVeKw/0.jpg)](https://youtu.be/FpLxOSHVeKw)

### Widget (Home app / Control Center)

[![widget demo](https://img.youtube.com/vi/lCtJF57DZQk/0.jpg)](https://youtu.be/lCtJF57DZQk)
