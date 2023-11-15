import { iterator } from './collection';

type Comparator<T> = (a: T, b: T) => number;

export function cmpFirst<T>(
  comparator: Comparator<T>,
): Comparator<readonly [T, ...unknown[]]> {
  return (a, b) => comparator(a[0], b[0]);
}

export function insertSorted<T>(
  array: T[],
  value: T,
  comparator: Comparator<T>,
) {
  for (let i = 0; i < array.length; i++) {
    if (comparator(value, array[i]) < 0) {
      array.splice(i, 0, value);
      return;
    }
  }
  array.push(value);
}

export function insertSortedExclusive<T>(
  array: T[],
  value: T,
  comparator: Comparator<T>,
) {
  for (let i = 0; i < array.length; i++) {
    const result = comparator(value, array[i]);
    if (result < 0) {
      array.splice(i, 0, value);
      return;
    } else if (result === 0) {
      array[i] = value;
      return;
    }
  }
  array.push(value);
}

export function *interleave<T>(
  iterables: readonly Iterable<T>[],
  comparator: Comparator<T>,
): Generator<T> {
  const c = cmpFirst(comparator);
  const nextValues: (readonly [T, Iterator<T>])[] = [];

  function addNext(itr: Iterator<T>) {
    const result = itr.next();
    if (!result.done) {
      insertSorted(nextValues, [result.value, itr], c);
    }
  }

  for (const iterable of iterables) {
    addNext(iterator(iterable));
  }

  while (nextValues.length > 0) {
    const [value, itr] = nextValues.shift() as [T, Iterator<T>];

    yield value;
    addNext(itr);
  }
}
