import { iterator } from './collection';

export type Zippable = readonly Iterable<unknown>[];

export type ZipValue<T extends Zippable> =
  T extends readonly [Iterable<infer First>, ...(infer Rest extends Zippable)]
    ? readonly [First, ...(ZipValue<Rest>)]
    : [];

export function *zip<T extends Zippable>(
  ...iterables: T
) {
  if (iterables.length === 0) return;
  const iterators = iterables.map(iterator);

  while (true) {
    const results = iterators.map(itr => itr.next());

    const done = results[0].done;
    if (results.slice(1).some(result => result.done !== done)) {
      throw new TypeError(`Iterator length mismatch`);
    } else if (done) {
      return;
    } else {
      yield results.map(result => result.value) as ZipValue<T>;
    }
  }
}
