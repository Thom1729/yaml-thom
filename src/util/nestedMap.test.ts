import { NestedMap } from './nestedMap';

describe(NestedMap, () => {
  test('one', () => {
    const map = new NestedMap<[string], number>(
      () => new Map(),
    );

    map.set('a', 1);

    expect(map.get('a')).toBe(1);
  });

  test('two', () => {
    const map = new NestedMap<[string, string], number>(
      () => new Map(),
      () => new Map(),
    );

    map.set('a', 'b', 1);

    expect(map.get('a', 'b')).toBe(1);
  });
});
