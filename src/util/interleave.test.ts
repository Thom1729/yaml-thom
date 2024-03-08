import { interleave, cmpFirst, unique } from './interleave';

function cmp(a: number, b: number) {
  if (a < b) {
    return -1;
  } else if (a > b) {
    return 1;
  } else {
    return 0;
  }
}

describe(interleave, () => {
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

  test('aaa', () => {
    expectInterleave(
      [
        [[1, 'a'], [2, 'a']],
        [[1, 'b'], [2, 'b']],
      ],
      cmpFirst(cmp),
      [
        [1, 'a'],
        [1, 'b'],
        [2, 'a'],
        [2, 'b'],
      ]
    );
  });
});

describe(unique, () => {
  function expectUnique<T>(
    iterable: Iterable<T>,
    cmp: (a: T, b: T) => number,
    expected: T[],
  ) {
    const result = unique(iterable, cmp);
    expect(Array.from(result)).toStrictEqual(expected);
  }

  test('empty', () => {
    expectUnique([], cmp, []);
  });

  test('single', () => {
    expectUnique([1], cmp, [1]);
  });

  test('multiple', () => {
    expectUnique([1, 2, 2, 3, 3, 3], cmp, [1, 2, 3]);
  });
});
