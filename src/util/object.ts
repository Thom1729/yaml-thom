export function getProperty<T extends object>(
  obj: T,
  key: PropertyKey,
  message: string,
) {
  if (Object.hasOwn(obj, key)) {
    return obj[key as keyof T];
  } else {
    throw new TypeError(message);
  }
}

export function invert<T extends Record<PropertyKey, PropertyKey>>(obj: T) {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [v, k])
  ) as {
    [K in keyof T as T[K]]: K
  };
}
