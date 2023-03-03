import { zip, type Zippable, type ZipValue } from './zip';

describe(zip, () => {
  function expectZip<T extends Zippable>(zippable: T, expected: ZipValue<T>[]) {
    expect(Array.from(zip(...zippable))).toEqual(expected);
  }

  test('no inputs', () => {
    expectZip([], []);
  });

  test('one input', () => {
    expectZip([[1, 2]] as const, [[1], [2]]);
  });

  test('two inputs', () => {
    expectZip([[1, 2], ['a', 'b']] as const, [[1, 'a'], [2, 'b']]);
  });

  test('three inputs', () => {
    expectZip(
      [[1, 2], ['a', 'b'], [true, false]] as const,
      [[1, 'a', true], [2, 'b', false]],
    );
  });

  test('mismatched length', () => {
    expect(() => Array.from(zip([1], []))).toThrow(TypeError);
  });
});
