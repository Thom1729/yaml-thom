import {
  capitalize,
  fromSnake,
  toPascal,
} from './string';

describe(capitalize, () => {
  test('empty', () => {
    expect(capitalize('')).toBe('');
  });

  test('single', () => {
    expect(capitalize('a')).toBe('A');
  });

  test('multiple', () => {
    expect(capitalize('ab')).toBe('Ab');
  });
});

describe(fromSnake, () => {
  test('empty', () => {
    expect(fromSnake('')).toEqual(['']);
  });

  test('single', () => {
    expect(fromSnake('foo')).toEqual(['foo']);
  });

  test('multiple', () => {
    expect(fromSnake('foo-bar-baz')).toEqual(['foo', 'bar', 'baz']);
  });
});

describe(toPascal, () => {
  test('empty', () => {
    expect(toPascal([''])).toEqual('');
  });

  test('single', () => {
    expect(toPascal(['foo'])).toEqual('Foo');
  });

  test('multiple', () => {
    expect(toPascal(['foo', 'bar', 'baz'])).toEqual('FooBarBaz');
  });
});
