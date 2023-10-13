import {
  NodeComparator,
  type RepresentationNode,
} from '@/nodes';
import { WeakCache } from '@/util';

export interface Validator {
  kind?: 'scalar' | 'sequence' | 'mapping';
  tag?: string;

  const?: RepresentationNode;

  minLength?: number;
}

export function validate(
  validator: Validator,
  node: RepresentationNode,
) {
  const cache = new WeakCache<[Validator, RepresentationNode], boolean | null>();
  const comparator = new NodeComparator();

  return  _validate(validator, node, cache, comparator);
}

function _validate(
  validator: Validator,
  node: RepresentationNode,
  cache: WeakCache<[Validator, RepresentationNode], boolean | null>,
  comparator: NodeComparator,
) {
  const cached = cache.get(validator, node);
  if (cached === true || cached === null) {
    return true;
  } else if (cached === false) {
    return false;
  } else {
    cache.set(validator, node, null);
  }

  if (validator.kind !== undefined) {
    if (node.kind !== validator.kind) {
      cache.set(validator, node, false);
      return false;
    }
  }

  if (validator.tag !== undefined) {
    if (node.tag !== validator.tag) {
      cache.set(validator, node, false);
      return false;
    }
  }

  if (validator.const !== undefined) {
    if (comparator.compare(validator.const, node) !== 0) {
      cache.set(validator, node, false);
      return false;
    }
  }

  if (validator.minLength !== undefined && node.kind === 'scalar') {
    if (node.size < validator.minLength) {
      cache.set(validator, node, false);
      return false;
    }
  }

  cache.set(validator, node, true);
  return true;
}
