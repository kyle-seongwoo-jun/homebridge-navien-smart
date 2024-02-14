import { NavienResponse } from '../interfaces';

export class ApiException<T> extends Error {
  constructor(
    readonly response: T,
    message: string,
  ) {
    super(message);

    this.name = 'ApiException';

    // Maintaining proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApiException);
    }

    // ES5 compatible
    Object.setPrototypeOf(this, ApiException.prototype);
  }

  static from<T>(response: NavienResponse<T>): ApiException<NavienResponse<T>> {
    return new ApiException(
      response,
      `code: ${response.code}, message: ${response.msg}`,
    );
  }
}
