export class ConfigurationException extends Error {
  constructor(
    readonly propertyName: string,
    message: string,
  ) {
    super(message);

    this.name = 'ConfigurationException';

    // Maintaining proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ConfigurationException);
    }

    // ES5 compatible
    Object.setPrototypeOf(this, ConfigurationException.prototype);
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
