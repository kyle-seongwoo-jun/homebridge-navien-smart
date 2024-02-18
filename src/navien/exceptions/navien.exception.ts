export abstract class NavienException extends Error {
  constructor(readonly message: string) {
    super(message);

    this.name = new.target.name;

    // Maintaining proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, new.target);
    }

    // ES5 compatible
    Object.setPrototypeOf(this, new.target.prototype);
  }

  public toString(): string {
    return `${this.name}: ${this.message}`;
  }
}
