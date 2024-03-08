import type { RepresentationNode } from './representationGraph';

const IS_DEFERRED: unique symbol = Symbol();

export interface DeferredResult<TReturn> {
  [IS_DEFERRED]: true;
  value: TReturn;
  deferred: (recurse: (value: RepresentationNode) => TReturn) => void;
}

function isDeferredResult<TResult>(
  result: TResult | DeferredResult<TResult>,
): result is DeferredResult<TResult> {
  if (
    result !== null && typeof result === 'object'
    && (result as { [IS_DEFERRED]?: true })[IS_DEFERRED]
  ) {
    return true;
  } else {
    return false;
  }
}

export function makeResult<TReturn, U extends TReturn>(
  value: U,
  deferred: (value: U, recurse: (value: RepresentationNode) => TReturn) => void,
): DeferredResult<TReturn> {
  return {
    [IS_DEFERRED]: true,
    value,
    deferred: (recurse: (value: RepresentationNode) => TReturn) => { deferred(value, recurse); },
  };
}

const PENDING: unique symbol = Symbol();

export function transformNode<TReturn>(
  node: RepresentationNode,
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

  return recurse(node);
}
