import { interleave } from './interleave';

describe(interleave, () => {
  function cmp(a: number, b: number) {
    if (a < b) {
      return -1;
    } else if (a > b) {
      return 1;
    } else {
      return 0;
    }
  }

  function expectInterleave<T>(
    iterables: Iterable<T>[],
    cmp: (a: T, b: T) => number,
    expected: T[],
  ) {
    const result = interleave(iterables, cmp);
    expect(Array.from(result)).toStrictEqual(expected);
  }

  test('empty', () => {
    expectInterleave(
      [],
      cmp,
      [],
    );
  });

  test('one', () => {
    expectInterleave(
      [[1, 2, 3]],
      cmp,
      [1, 2, 3],
    );
  });

  test('two', () => {
    expectInterleave(
      [[1, 3, 5], [1, 4, 6]],
      cmp,
      [1, 1, 3, 4, 5, 6],
    );
  });
});
