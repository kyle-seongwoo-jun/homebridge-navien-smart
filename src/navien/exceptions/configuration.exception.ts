import { NavienException } from './navien.exception';

export class ConfigurationException extends NavienException {
  constructor(
    readonly propertyName: string,
    message: string,
  ) {
    super(message);
  }

  static empty(propertyName: string): ConfigurationException {
    return new ConfigurationException(
      propertyName,
      `No ${propertyName} in config. Please add "${propertyName}" on your config.json.`,
    );
  }

  static invalid(propertyName: string, value: unknown, options: { validValue?: string } = {}): ConfigurationException {
    const { validValue } = options;
    const message = [
      `"${value}" is not valid for ${propertyName}`,
      validValue ? `it should be ${validValue}.` : '',
      'Please check your config.json.',
    ].filter(x => x.length > 0).join(' ');

    return new ConfigurationException(propertyName, message);
  }
}
