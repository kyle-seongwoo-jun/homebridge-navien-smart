import { NavienResponse } from '../interfaces/index.js';
import { NavienException } from './navien.exception.js';

export class ApiException<T> extends NavienException {
  constructor(
    readonly response: T,
    message: string,
  ) {
    super(message);
  }

  static from<T>(response: NavienResponse<T>): ApiException<NavienResponse<T>> {
    return new ApiException(
      response,
      `code: ${response.code}, message: ${response.msg}`,
    );
  }
}
