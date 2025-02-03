# Changelog

## [1.8.0](https://github.com/kyle-seongwoo-jun/homebridge-navien-smart/compare/v1.7.6...v1.8.0) (2025-02-03)


### Features

* add option for notification sound on operation ([6554f17](https://github.com/kyle-seongwoo-jun/homebridge-navien-smart/commit/6554f17db14d7385a4fd24153ba02663d635adc8))
* add separateControl config ([4b73561](https://github.com/kyle-seongwoo-jun/homebridge-navien-smart/commit/4b73561a2c22ceb2527d55e7b1d65463537470fa))
* support separate control & current temperature ([4b73561](https://github.com/kyle-seongwoo-jun/homebridge-navien-smart/commit/4b73561a2c22ceb2527d55e7b1d65463537470fa))


### Bug Fixes

* add config migration to support old version ([c906dc0](https://github.com/kyle-seongwoo-jun/homebridge-navien-smart/commit/c906dc0f22e3b50700bba7a3871757e39546e0cd))
* handle config change for accessoryType & separateControl ([23424f4](https://github.com/kyle-seongwoo-jun/homebridge-navien-smart/commit/23424f4c70a2d9b006bf110ee956ed4aa8c82ca4))

## [1.7.6](https://github.com/kyle-seongwoo-jun/homebridge-navien-smart/compare/v1.7.5...v1.7.6) (2025-01-15)


### Bug Fixes

* handle missing fields from device event ([a2dec31](https://github.com/kyle-seongwoo-jun/homebridge-navien-smart/commit/a2dec313a1de2adc547016893fd3bc8549329426))

## [1.7.5](https://github.com/kyle-seongwoo-jun/homebridge-navien-smart/compare/v1.7.4...v1.7.5) (2024-11-12)


### Bug Fixes

* add missing updates for lock file ([f9892f7](https://github.com/kyle-seongwoo-jun/homebridge-navien-smart/commit/f9892f713b582268ec93ae307e79a57e06ff32ca))

## [1.7.4](https://github.com/kyle-seongwoo-jun/homebridge-navien-smart/compare/v1.7.3...v1.7.4) (2024-11-12)


### Bug Fixes

* update bin for esm ([fa22b2f](https://github.com/kyle-seongwoo-jun/homebridge-navien-smart/commit/fa22b2ff94b7f80b8320df0be48a99b3665d9495))

## [1.7.3](https://github.com/kyle-seongwoo-jun/homebridge-navien-smart/compare/v1.7.2...v1.7.3) (2024-11-11)


### Bug Fixes

* paho is not working with esm, so added a patch ([5d1aaf0](https://github.com/kyle-seongwoo-jun/homebridge-navien-smart/commit/5d1aaf0c8a44c3b884335ff9ef76754e76df2b18))
* remove cache accessories that wasn't discovered ([567674f](https://github.com/kyle-seongwoo-jun/homebridge-navien-smart/commit/567674f2274263e95056fa8ad824c901d686c141))
* support homebridge 2.0 ([810d12a](https://github.com/kyle-seongwoo-jun/homebridge-navien-smart/commit/810d12aa9c7db9fe9319c50c1c3e18cb56606ab8))

## [1.7.2](https://github.com/kyle-seongwoo-jun/homebridge-navien-smart/compare/v1.7.1...v1.7.2) (2024-11-08)


### Bug Fixes

* divide device & device status class to fix cache issue ([5750fdb](https://github.com/kyle-seongwoo-jun/homebridge-navien-smart/commit/5750fdb07483ce0144cd759eea748e047478c404))

## [1.7.1](https://github.com/kyle-seongwoo-jun/homebridge-navien-smart/compare/v1.7.0...v1.7.1) (2024-11-08)


### Bug Fixes

* **auth:** fix refreshing token is not working ([6181ff8](https://github.com/kyle-seongwoo-jun/homebridge-navien-smart/commit/6181ff87d7248dfdb34c1a1886046b086145c6ac))

## [1.7.0](https://github.com/kyle-seongwoo-jun/homebridge-navien-smart/compare/v1.6.1...v1.7.0) (2024-11-06)


### Features

* **api:** support single type of em models ([06516c0](https://github.com/kyle-seongwoo-jun/homebridge-navien-smart/commit/06516c02a3c305c4e064cc803aa4a1780a2dc67d))
* **homebridge:** handle not responding device ([b523f16](https://github.com/kyle-seongwoo-jun/homebridge-navien-smart/commit/b523f165a4f72caa01321826f7a4bd0f1b93f1d0))


### Bug Fixes

* **auth:** handle expired refresh token in account auth mode ([0fae675](https://github.com/kyle-seongwoo-jun/homebridge-navien-smart/commit/0fae67595f42474bef2f706759b81c2b044033af))
* **auth:** store new token after refresh instead of old token ([11af785](https://github.com/kyle-seongwoo-jun/homebridge-navien-smart/commit/11af78548ca7a6bb8a8626056db6d1ebe9aaf854))

## [1.6.1](https://github.com/kyle-seongwoo-jun/homebridge-navien-smart/compare/v1.6.0...v1.6.1) (2024-11-01)


### Bug Fixes

* **login:** add missing refreshToken logic that should be called ([9fec8fd](https://github.com/kyle-seongwoo-jun/homebridge-navien-smart/commit/9fec8fdbfcfd7b5ccb361b856ed271dcf010e24c))
* **pubsub:** update with new topic ([5cd05ce](https://github.com/kyle-seongwoo-jun/homebridge-navien-smart/commit/5cd05ce807da9fb9852cb4f0e1563191a0ffd8c3))

## [1.6.0](https://github.com/kyle-seongwoo-jun/homebridge-navien-smart/compare/v1.5.0...v1.6.0) (2024-10-14)


### Features

* **api:** migrate from navien api v1.0 to v2.0 ([f77c898](https://github.com/kyle-seongwoo-jun/homebridge-navien-smart/commit/f77c898a0f64734163d9a6725540a4945d4271e2))
* **auth:** add change password later logic ([6f20a04](https://github.com/kyle-seongwoo-jun/homebridge-navien-smart/commit/6f20a046c53d460592eabd167b86c330f5577a60))
* **auth:** handle login success and password reset ([14c21f4](https://github.com/kyle-seongwoo-jun/homebridge-navien-smart/commit/14c21f46cf0285a2a3250d88614def96e823e5b8))

## [1.5.0](https://github.com/kyle-seongwoo-jun/homebridge-navien-smart/compare/v1.4.0...v1.5.0) (2024-02-22)


### Features

* add lock functionality to ElectricMat device and Navien API ([10fb265](https://github.com/kyle-seongwoo-jun/homebridge-navien-smart/commit/10fb2656e65fb33b1cb9b50b9b21bf5d4d2e219f))

## [1.4.0](https://github.com/kyle-seongwoo-jun/homebridge-navien-smart/compare/v1.3.0...v1.4.0) (2024-02-21)


### Features

* control idle state to set min temperature ([d752249](https://github.com/kyle-seongwoo-jun/homebridge-navien-smart/commit/d752249e1e56f457d57dce978875ab403dbb3946))


### Bug Fixes

* remove showCurrentTemperatureAsTarget option ([991f201](https://github.com/kyle-seongwoo-jun/homebridge-navien-smart/commit/991f2011c514f777edc28baccc6ee4b5019be76c))
* update mininum temperature value for idle state ([1ba4576](https://github.com/kyle-seongwoo-jun/homebridge-navien-smart/commit/1ba457603192348f84c4226eb6abd08ad6ad1c35))

## [1.3.0](https://github.com/kyle-seongwoo-jun/homebridge-navien-smart/compare/v1.2.1...v1.3.0) (2024-02-20)


### Features

* implement heater service and add accessoryType property to config ([f84c1c8](https://github.com/kyle-seongwoo-jun/homebridge-navien-smart/commit/f84c1c88f114943e0651dcbca1a79018566bd8b9))

## [1.2.1](https://github.com/kyle-seongwoo-jun/homebridge-navien-smart/compare/v1.2.0...v1.2.1) (2024-02-18)


### Bug Fixes

* add exception handling and error logging when refreshing aws session ([0843462](https://github.com/kyle-seongwoo-jun/homebridge-navien-smart/commit/08434625af26f2d644db1b24b25565013504a7f2))
* refresh api session when expired ([f023dc0](https://github.com/kyle-seongwoo-jun/homebridge-navien-smart/commit/f023dc0a562964e9951284a814f7182edbf76eb2))

## [1.2.0](https://github.com/kyle-seongwoo-jun/homebridge-navien-smart/compare/v1.1.0...v1.2.0) (2024-02-15)


### Features

* add showCurrentTemperatureAsTarget option to config ([#5](https://github.com/kyle-seongwoo-jun/homebridge-navien-smart/issues/5)) ([91c0682](https://github.com/kyle-seongwoo-jun/homebridge-navien-smart/commit/91c0682f693f6fd29e1a43da0fe2490cdc54284b))

## [1.1.0](https://github.com/kyle-seongwoo-jun/homebridge-navien-smart/compare/v1.0.1...v1.1.0) (2024-02-15)


### Features

* refresh AWS session if AWS PubSub connection is disrupted ([d42bc7b](https://github.com/kyle-seongwoo-jun/homebridge-navien-smart/commit/d42bc7b4cb32edaecf019ffc1ef4da7fb805f83a))

## [1.0.1](https://github.com/kyle-seongwoo-jun/homebridge-navien-smart/compare/v1.0.0...v1.0.1) (2024-02-14)


### Bug Fixes

* fix typo on modelName getter ([6b235af](https://github.com/kyle-seongwoo-jun/homebridge-navien-smart/commit/6b235af8790c2eb595d481c75e4aae077d070eb5))
* Remove unnecessary code for current temperature ([a14784a](https://github.com/kyle-seongwoo-jun/homebridge-navien-smart/commit/a14784af72a5ea6386f56e905a2e3f0799c493fd))
