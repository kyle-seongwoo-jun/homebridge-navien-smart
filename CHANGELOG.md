# Changelog

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
