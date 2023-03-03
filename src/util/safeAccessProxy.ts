export function safeAccessProxy<
  T extends object,
  Props extends keyof T,
>(
  obj: T,
  propertyNames: Props[],
) {
  const props = new Set(propertyNames);
  return new Proxy(obj, {
    get(target, prop) {
      if (target.hasOwnProperty(prop)) {
        return target[prop as keyof T];
      } else {
        throw new Error(`Missing property ${prop.toString()} was not specified`);
      }
    }
  }) as T & { [K in Props]-?: T[K] };
}
