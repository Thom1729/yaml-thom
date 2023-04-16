import { zip } from '@/util';

import type { RepresentationMapping, RepresentationNode, RepresentationScalar, RepresentationSequence } from '.';

export function equals(a: RepresentationNode, b: RepresentationNode) {
  return new NodeComparator().compare(a, b) === 0;
}

function cmpStrings(a: string, b: string) {
  // if (a === b) return 0;

  let i = 0, j = 0;
  while (true) {
    if (i === a.length && j === b.length) {
      return 0;
    } else if (i === a.length) {
      return -1;
    } else if (j === b.length) {
      return 1;
    }

    const aChar = a.charCodeAt(i);
    const bChar = b.charCodeAt(j);

    if (aChar !== bChar) return aChar - bChar;

    i += (aChar > 0xffff ? 2 : 1);
    j += (bChar > 0xffff ? 2 : 1);
  }
}

const KIND_INDEX = {
  scalar: 0,
  sequence: 1,
  mapping: 1,
};

// TODO: Handle cycles, etc
class NodeComparator {
  cache = new Map<RepresentationNode, Map<RepresentationNode, number | null>>();

  getCached(a: RepresentationNode, b: RepresentationNode) {
    const x = this.cache.get(a)?.get(b);
    return x === undefined
      ? this.cache.get(b)?.get(a)
      : x;
  }

  setCached(a: RepresentationNode, b: RepresentationNode, value: number | null) {
    let aMap = this.cache.get(a);
    if (aMap === undefined) {
      aMap = new Map();
      this.cache.set(a, aMap);
    }
    aMap.set(b, value);
  }

  compare(a: RepresentationNode, b: RepresentationNode): number {
    if (a === b) return 0;

    if (a.kind !== b.kind) return KIND_INDEX[a.kind] - KIND_INDEX[b.kind];
    if (a.tag !== b.tag) return cmpStrings(a.tag, b.tag);
    if (a.kind === 'scalar') return cmpStrings(a.content, (b as RepresentationScalar).content);
    if (a.size !== b.size) return a.size - b.size;

    const cached = this.getCached(a, b);
    if (cached !== undefined) return cached ?? 0;

    this.setCached(a, b, null);

    if (a.kind === 'sequence') {
      for (const [aItem, bItem] of zip(a, (b as RepresentationSequence))) {
        const diff = this.compare(aItem, bItem);
        if (diff !== 0) {
          this.setCached(a, b, diff);
          return diff;
        }
      }
    } else {
      // This is wrong and assumes that the keys are in the same order.
      // TODO: Solve the Graph Isomorphism prize in poly time and collect my Turing award.
      for (const [[aKey, aValue], [bKey, bValue]] of zip(a, (b as RepresentationMapping))) {
        const keyDiff = this.compare(aKey, bKey);
        if (keyDiff !== 0) {
          this.setCached(a, b, keyDiff);
          return keyDiff;
        }
        const valueDiff = this.compare(aValue, bValue);
        if (valueDiff !== 0) {
          this.setCached(a, b, valueDiff);
          return valueDiff;
        }
      }
    }

    this.setCached(a, b, 0);
    return 0;
  }
}
