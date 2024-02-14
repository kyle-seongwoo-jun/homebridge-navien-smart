
export class AuthException extends Error {
  constructor(message: string) {
    super(message);

    this.name = 'AuthException';

    // Maintaining proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AuthException);
    }

    // ES5 compatible
    Object.setPrototypeOf(this, AuthException.prototype);
  }
}
