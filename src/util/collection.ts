export function iterator<T>(iterable: Iterable<T>) {
  return iterable[Symbol.iterator]();
}

export function single<T>(iterable: Iterable<T>, message?: string) {
  const itr = iterator(iterable);

  const first = itr.next();
  if (first.done) throw new TypeError(message ?? `No value`);

  const second = itr.next();
  if (!second.done) throw new TypeError(message ?? `Multiple values`);

  return first.value;
}

export function singleOrNull<T>(iterable: Iterable<T>, message?: string) {
  const itr = iterator(iterable);

  const first = itr.next();
  if (first.done) return null;

  const second = itr.next();
  if (!second.done) throw new TypeError(message ?? `Multiple values`);

  return first.value;
}

export function *enumerate<T>(iterable: Iterable<T>, start: number = 0) {
  let i = start;
  for (const item of iterable) {
    yield [i++, item] as const;
  }
}
