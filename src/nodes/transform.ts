import type { RepresentationNode } from './representationGraph';

const IS_DEFERRED: unique symbol = Symbol();

export interface DeferredResult<TReturn> {
  [IS_DEFERRED]: true;
  value: TReturn;
  deferred: undefined | ((recurse: (value: RepresentationNode) => TReturn) => void);
}

function isDeferredResult<TResult>(
  result: TResult | DeferredResult<TResult>,
): result is DeferredResult<TResult> {
  return (result as { [IS_DEFERRED]?: true })[IS_DEFERRED] ?? false;
}

export function makeResult<TReturn, U extends TReturn>(
  value: U,
  deferred?: (value: U, recurse: (value: RepresentationNode) => TReturn) => void,
): DeferredResult<TReturn> {
  return {
    [IS_DEFERRED]: true,
    value,
    deferred: deferred
      ? (recurse: (value: RepresentationNode) => TReturn) => { deferred(value, recurse); }
      : undefined,
  };
}

const PENDING: unique symbol = Symbol();

export function nodeTransformer<TReturn>(
  transformer: (node: RepresentationNode) => TReturn | DeferredResult<TReturn>,
) {
  const cache = new WeakMap<RepresentationNode, TReturn | typeof PENDING>();

  function recurse(node: RepresentationNode): TReturn {
    const cached = cache.get(node);
    if (cached === PENDING) {
      throw new Error('infinite recursion');
    } else if (cached !== undefined) {
      return cached;
    } else {
      cache.set(node, PENDING);
    }

    const result = transformer(node);
    if (isDeferredResult(result)) {
      const { value, deferred } = result;
      cache.set(node, value);
      if (deferred !== undefined) deferred(recurse);
      return value;
    } else {
      cache.set(node, result);
      return result;
    }
  }

  return recurse;
}
