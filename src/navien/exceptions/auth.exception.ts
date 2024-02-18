import { NavienException } from './navien.exception';

export class AuthException extends NavienException {
  constructor(message: string) {
    super(message);
  }
}
