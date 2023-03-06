import {
  objectHasOwn,
} from './strict';

export function safeAccessProxy<
  T extends object,
>(
  obj: T,
) {
  return new Proxy(obj, {
    get(target, prop) {
      if (objectHasOwn(target, prop)) {
        return target[prop];
      } else {
        throw new Error(`Missing property ${prop.toString()} was not specified`);
      }
    }
  }) as Required<T>;
}
