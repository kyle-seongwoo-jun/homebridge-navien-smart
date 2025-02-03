import { NavienException } from './navien.exception.js';

export class ValidationException extends NavienException {
  constructor(message: string) {
    super(message);
  }
}
