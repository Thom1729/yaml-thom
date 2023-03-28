export function assertionFunction<U>(
  predicate: (value: unknown) => value is U,
) {
  return <T>(value: T, message?: string): asserts value is T & U => {
    if (!predicate(value)) throw new TypeError(message);
  };
}

export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

export const assertString = assertionFunction(isString);

export function isKeyOf<K extends string | number | symbol, T extends object>(
  key: K,
  obj: T,
): key is K & keyof T {
  return Object.hasOwn(obj, key);
}

export function assertKeyOf<K extends string | number | symbol, T extends object>(
  key: K,
  obj: T,
  message?: string,
): asserts key is K & keyof T {
  if (!Object.hasOwn(obj, key)) throw new TypeError(message);
}
