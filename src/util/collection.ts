export function sorted<T>(arr: T[], comparator?: (a: T, b: T) => number) {
  const ret = arr.slice();
  ret.sort(comparator);
  return ret;
}

export function single<T>(itr: Iterable<T>) {
  const arr = Array.from(itr);
  switch (arr.length) {
    case 0: throw new TypeError(`No value`);
    case 1: return arr[0];
    default: throw new TypeError(`${arr.length} values`);
  }
}

export function singleOrNull<T>(itr: Iterable<T>) {
  const arr = Array.from(itr);
  switch (arr.length) {
    case 0: return null;
    case 1: return arr[0];
    default: throw new TypeError(`${arr.length} values`);
  }
}
