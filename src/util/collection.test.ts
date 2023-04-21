import { single, singleOrNull } from './collection';

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
