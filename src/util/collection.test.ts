import { single, singleOrNull, enumerate } from './collection';

describe(single, () => {
  test('empty', () => {
    expect(() => { single([]); }).toThrow(TypeError);
  });

  test('one element', () => {
    expect(single([0])).toBe(0);
  });

  test('empty', () => {
    expect(() => { single([0, 1]); }).toThrow(TypeError);
  });
});

describe(singleOrNull, () => {
  test('empty', () => {
    expect(singleOrNull([])).toBe(null);
  });

  test('one element', () => {
    expect(singleOrNull([0])).toBe(0);
  });

  test('empty', () => {
    expect(() => { singleOrNull([0, 1]); }).toThrow(TypeError);
  });
});

describe(enumerate, () => {
  test('empty', () => {
    expect(Array.from(enumerate([]))).toStrictEqual([]);
  });

  test('from zero', () => {
    expect(Array.from(enumerate([1, 2, 3]))).toStrictEqual([[0, 1], [1, 2], [2, 3]]);
  });

  test('from one', () => {
    expect(Array.from(enumerate([1, 2, 3], 1))).toStrictEqual([[1, 1], [2, 2], [3, 3]]);
  });
});
