import { NodeComparator, isRepresentationNode } from '@';
import { NestedMap } from '@/util';

export function deepEquals(a: unknown, b: unknown) {
  const nodeComparator = new NodeComparator();
  const cache = new NestedMap<[unknown, unknown], undefined>(() => new Map(), () => new Map());

  function _deepEquals(a: unknown, b: unknown) {
    if (a === b) {
      return true;
    } else if (a && b && typeof a === 'object' && typeof b === 'object') {
      if (isRepresentationNode(a) && isRepresentationNode(b)) {
        return nodeComparator.equals(a, b);
      }

      if (cache.has(a, b) || cache.has(b, a)) {
        return true;
      } else {
        cache.set(a, b, undefined);
      }

      if (Array.isArray(a) && Array.isArray(b)) {
        if (a.length !== b.length) return false;

        for (let i = 0; i < a.length; i++) {
          if (!_deepEquals(a[i], b[i])) return false;
        }

        return true;
      } else if (a && b && typeof a === 'object' && typeof b === 'object') {
        const aKeys = Object.keys(a);
        const bKeys = Object.keys(b);
        if (aKeys.length !== bKeys.length) return false;
        for (const k of aKeys) {
          if (!Object.hasOwn(b, k)) return false;
          if (!_deepEquals((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k])) return false;
        }
        return true;
      }
    } else {
      return false;
    }
  }

  return _deepEquals(a, b);
}
