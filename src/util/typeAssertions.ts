export function assertString(value: unknown) {
  if (typeof value === 'string') {
    return value;
  } else {
    throw new TypeError(`expected string`);
  }
}

export function assertBoolean(value: unknown) {
  if (typeof value === 'boolean') {
    return value;
  } else {
    throw new TypeError(`expected boolean`);
  }
}

export function assertArray(value: unknown) {
  if (Array.isArray(value)) {
    return value as unknown[];
  } else {
    throw new TypeError(`expected Array`);
  }
}

export function assertObject(value: unknown) {
  if (
    typeof value === 'object' &&
    value !== null &&
    value.constructor === Object &&
    Object.prototype.toString.call(value) === '[object Object]'
  ) {
    return value as { [k in string]?: unknown };
  } else {
    throw new TypeError(`expected object`);
  }
}

export function assertObjectShape<
  RequiredKey extends string,
  OptionalKey extends string,
>(
  obj: object,
  requiredKeys: RequiredKey[],
  optionalKeys: OptionalKey[],
) {
  const objectKeys = new Set<string>(Object.keys(obj));
  const allowedKeys = new Set<string>([...requiredKeys, ...optionalKeys]);

  for (const key of requiredKeys) {
    if (!objectKeys.has(key)) {
      throw new TypeError(`Expected key ${key}`);
    }
  }

  for (const key of objectKeys) {
    if (!allowedKeys.has(key)) {
      throw new TypeError(`Unexpected key ${key}`);
    }
  }

  return obj as { [K in RequiredKey]: unknown } & { [K in OptionalKey]?: unknown };
}
