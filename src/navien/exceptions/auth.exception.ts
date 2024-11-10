import { NavienException } from './navien.exception.js';

export class AuthException extends NavienException {
  constructor(message: string) {
    super(message);
  }
}
