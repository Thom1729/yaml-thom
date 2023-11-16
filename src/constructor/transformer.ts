export interface Result<T extends object, TReturn> {
  value: TReturn;
  deferred: undefined | ((recurse: (value: T) => TReturn) => void);
}

function result<T extends object, TReturn, U extends TReturn>(
  value: U,
  deferred?: (value: U, recurse: (value: T) => TReturn) => void,
): Result<T, TReturn> {
  return {
    value,
    deferred: deferred
      ? (recurse: (value: T) => TReturn) => { deferred(value, recurse); }
      : undefined,
  };
}

const PENDING: unique symbol = Symbol();

export type Transformer<T extends object, TReturn> = (
  node: T,
  result: <U extends TReturn>(
    value: U,
    deferred?: (value: U, recurse: (value: T) => TReturn) => void,
  ) => Result<T, TReturn>,
) => Result<T, TReturn>;

export function transformer<T extends object, TReturn>(
  transformer: (
    node: T,
    result: <U extends TReturn>(
      value: U,
      deferred?: (value: U, recurse: (value: T) => TReturn) => void,
    ) => Result<T, TReturn>,
  ) => Result<T, TReturn>,
) {
  const cache = new WeakMap<T, TReturn | typeof PENDING>();

  function recurse(node: T): TReturn {
    const cached = cache.get(node);
    if (cached === PENDING) {
      throw new Error('infinite recursion');
    } else if (cached !== undefined) {
      return cached;
    } else {
      cache.set(node, PENDING);
    }

    const { value, deferred } = transformer(node, result);
    cache.set(node, value);
    if (deferred !== undefined) deferred(recurse);
    return value;
  }

  return recurse;
}
