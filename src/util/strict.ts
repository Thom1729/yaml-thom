export const strictFromEntries = Object.fromEntries as
  <TPair extends readonly [PropertyKey, unknown]>(entries: Iterable<TPair>) => {
    [K in TPair[0]]: (TPair & [K, unknown])[1]
  };

export const objectHasOwn = Object.hasOwn as
  <T extends object, K extends PropertyKey>(o: T, v: K) => v is K & keyof T;

export const strictKeys = Object.keys as
  // <T extends object>(o: T) => Array<keyof T & string | `${keyof T & number}`>;
  <T extends object>(o: T) => (keyof T)[];

export const strictValues = Object.values as
  // <T extends object>(o: T) => Array<keyof T & string | `${keyof T & number}`>;
  <T extends object>(o: T) => (T[keyof T])[];

export type ObjectEntry<T extends object> = {
  [K in keyof Required<T>]-?: readonly [K, T[K]]
}[keyof T];

export const strictEntries = Object.entries as
  <T extends object>(o: T) => ObjectEntry<T>[];
