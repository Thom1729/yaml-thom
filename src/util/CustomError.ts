export class CustomError extends Error {
  constructor(...args: ConstructorParameters<ErrorConstructor>) {
    super(...args);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
