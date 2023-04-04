export function Y<R, T extends unknown[]>(f: (rec: (...arg: T) => R, ...arg: T) => R) {
  return function rec(...arg: T): R {
    return f(rec, ...arg);
  };
}
