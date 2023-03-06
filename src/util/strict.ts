export type BaseKey = string | number | symbol;
type BaseEntries = Iterable<readonly [BaseKey, unknown]>;
type FromEntries<T extends BaseEntries> = T extends Iterable<infer Pair>
  ? [Pair] extends [readonly [infer Key extends BaseKey, unknown]]
    ? { [K in Key]: (Pair & [K, unknown])[1] }
    : never
  : never;

export const strictFromEntries = Object.fromEntries as
  <T extends BaseEntries>(entries: T) => FromEntries<T>;

export const objectHasOwn = Object.hasOwn as <T extends object, K extends BaseKey>(o: T, v: K) => v is K & keyof T;
