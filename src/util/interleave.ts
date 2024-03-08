import { enumerate, iterate } from './collection';

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

class PriorityQueue<T> {
  readonly items: T[] = [];
  readonly comparator: Comparator<T>;

  constructor(comparator: Comparator<T>) {
    this.comparator = comparator;
  }

  enqueue(item: T) {
    insertSorted(this.items, item, this.comparator);
  }

  dequeue() {
    return this.items.shift();
  }
}

export function *interleave<T>(
  iterables: readonly Iterable<T>[],
  comparator: Comparator<T>,
): Iterable<T> {
  const queue = new PriorityQueue<{
    value: T,
    iterator: Iterator<T>,
    index: number,
  }>(
    (a, b) => comparator(a.value, b.value) || (a.index - b.index)
  );

  function addNext(iterator: Iterator<T>, index: number) {
    const result = iterator.next();
    if (!result.done) {
      queue.enqueue({ value: result.value, iterator, index });
    }
  }

  for (const [index, iterable] of enumerate(iterables)) {
    addNext(iterate(iterable), index);
  }

  while (true) {
    const result = queue.dequeue();
    if (result === undefined) return;

    const { value, iterator, index } = result;
    yield value;
    addNext(iterator, index);
  }
}

export function *unique<T>(iterable: Iterable<T>, comparator: Comparator<T>): Iterable<T> {
  const iterator = iterate(iterable);
  let result = iterator.next();
  if (result.done) return;

  let previousValue = result.value;
  while (true) {
    result = iterator.next();
    if (result.done) break;
    if (comparator(previousValue, result.value) !== 0) yield previousValue;
    previousValue = result.value;
  }
  yield previousValue;
}
