import { zip, cmpStringsByCodepoint, WeakCache } from '@/util';

import {
  NonSpecificTag,
  RepresentationMapping,
  RepresentationNode,
  RepresentationScalar,
  RepresentationSequence,
  type UnresolvedNode,
} from '.';

export function equals(a: RepresentationNode, b: RepresentationNode) {
  return new NodeComparator().compare(a, b) === 0;
}

const KIND_INDEX = {
  scalar: 0,
  sequence: 1,
  mapping: 2,
};

// TODO: Handle cycles, etc
export class NodeComparator {
  private readonly cache = new WeakCache<[UnresolvedNode, UnresolvedNode], number | null>();

  equals(a: UnresolvedNode, b: UnresolvedNode): boolean {
    return this.compare(a, b) === 0;
  }

  compare(a: UnresolvedNode, b: UnresolvedNode): number {
    if (a === b) return 0;

    if (a.kind !== b.kind) return KIND_INDEX[a.kind] - KIND_INDEX[b.kind];

    // if (a.tag !== b.tag) return cmpStringsByCodepoint(a.tag, b.tag);
    if (a.tag === b.tag) {
      // pass
    } else if (a.tag === NonSpecificTag.exclamation) {
      return -1;
    } else if (a.tag === NonSpecificTag.question) {
      if (b.tag === NonSpecificTag.exclamation) {
        return 1;
      } else {
        return -1;
      }
    } else {
      if (typeof b.tag === 'symbol') {
        return 1;
      } else {
        return cmpStringsByCodepoint(a.tag, b.tag);
      }
    }

    if (a.kind === 'scalar') return cmpStringsByCodepoint(a.content, (b as RepresentationScalar).content);
    if (a.size !== b.size) return a.size - b.size;

    const cached = this.cache.get(a, b) ?? this.cache.get(b, a);
    if (cached !== undefined) return cached ?? 0;

    this.cache.set(a, b, null);

    if (a.kind === 'sequence') {
      for (const [aItem, bItem] of zip(a, (b as RepresentationSequence))) {
        const diff = this.compare(aItem, bItem);
        if (diff !== 0) {
          this.cache.set(a, b, diff);
          return diff;
        }
      }
    } else {
      // This is wrong and assumes that the keys are in the same order.
      // TODO: Solve the Graph Isomorphism prize in poly time and collect my Turing award.
      for (const [[aKey, aValue], [bKey, bValue]] of zip(a, (b as RepresentationMapping))) {
        const keyDiff = this.compare(aKey, bKey);
        if (keyDiff !== 0) {
          this.cache.set(a, b, keyDiff);
          return keyDiff;
        }
        const valueDiff = this.compare(aValue, bValue);
        if (valueDiff !== 0) {
          this.cache.set(a, b, valueDiff);
          return valueDiff;
        }
      }
    }

    this.cache.set(a, b, 0);
    return 0;
  }
}
