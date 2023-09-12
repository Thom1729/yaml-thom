import { WeakCache } from './weakCache';

describe(WeakCache, () => {

  type A = { a: number };
  type B = { b: number };
  type C = { c: number };

  const a = { a: 1 };
  const b = { b: 1 };
  const c = { c: 1 };

  test('one level', () => {
    const cache = new WeakCache<[A], string>();
    expect(cache.get(a)).toBeUndefined();

    cache.set(a, 'yes');
    expect(cache.get(a)).toBe('yes');
  });

  test('two levels', () => {
    const cache = new WeakCache<[A, B], string>();
    expect(cache.get(a, b)).toBeUndefined();

    cache.set(a, b, 'yes');
    expect(cache.get(a, b)).toBe('yes');
  });

  test('three levels', () => {
    const cache = new WeakCache<[A, B, C], string>();
    expect(cache.get(a, b, c)).toBeUndefined();

    cache.set(a, b, c, 'yes');
    expect(cache.get(a, b, c)).toBe('yes');
  });
});
