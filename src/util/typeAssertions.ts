export function assertionFunction<V, U extends V>(
  predicate: (value: V) => value is U,
) {
  return <T extends V>(value: T, message?: string): asserts value is T & U => {
    if (!predicate(value)) throw new TypeError(message);
  };
}

export function isString(value: unknown): value is string {
  return typeof value === 'string';
}
export const assertString = assertionFunction(isString);

export function isBigInt(value: unknown): value is bigint {
  return typeof value === 'bigint';
}
export function assertBigInt(value: unknown, message?: string): asserts value is bigint {
  if (!isBigInt(value)) throw new TypeError(message);
}

export function isNotNull<T>(value: T): value is Exclude<T, null> {
  return value === null;
}

export function assertNotNull<T>(value: T, message?: string): asserts value is Exclude<T, null> {
  if (value === null) throw new TypeError(message);
}

export const isArray = Array.isArray as (arg: unknown) => arg is ReadonlyArray<unknown> | Array<unknown>;

export function assertNotEmpty<T>(
  array: readonly T[],
  message: string = `expected nonempty`,
): asserts array is readonly [T, ...T[]] {
  if (array.length === 0) throw new TypeError(message);
}

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

export function isNotUndefined<T>(value: T): value is Exclude<T, undefined> {
  return value === undefined;
}

export function assertNotUndefined<T>(
  value: T,
  message?: string,
): asserts value is Exclude<T, undefined> {
  if (value === undefined) {
    throw new TypeError(message ?? `assertNotUndefined`);
  }
}

export function assertEnum<const T>(values: Iterable<T>) {
  const set = new Set<unknown>(values);
  return (value: unknown): asserts value is T => {
    if (!set.has(value)) {
      throw new TypeError('assertEnum');
    }
  };
}
