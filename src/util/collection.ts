export function single<T>(itr: Iterable<T>, message?: string) {
  const arr = Array.from(itr);
  switch (arr.length) {
    case 0: throw new TypeError(message ?? `No value`);
    case 1: return arr[0];
    default: throw new TypeError(message ?? `${arr.length} values`);
  }
}

export function singleOrNull<T>(itr: Iterable<T>, message?: string) {
  const arr = Array.from(itr);
  switch (arr.length) {
    case 0: return null;
    case 1: return arr[0];
    default: throw new TypeError(message ?? `${arr.length} values`);
  }
}
