export function single<T>(iterable: Iterable<T>, message?: string) {
  const itr = iterable[Symbol.iterator]();

  const first = itr.next();
  if (first.done) throw new TypeError(message ?? `No value`);

  const second = itr.next();
  if (!second.done) throw new TypeError(message ?? `Multiple values`);

  return first.value;
}

export function singleOrNull<T>(iterable: Iterable<T>, message?: string) {
  const itr = iterable[Symbol.iterator]();

  const first = itr.next();
  if (first.done) return null;

  const second = itr.next();
  if (!second.done) throw new TypeError(message ?? `Multiple values`);

  return first.value;
}
