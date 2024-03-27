import { zip, cmpStringsByCodepoint, NestedMap } from '@/util';

import {
  type RepresentationNode,
  type RepresentationMapping,
  type RepresentationScalar,
  type RepresentationSequence,
} from './representationGraph';

const KIND_INDEX = {
  scalar: 0,
  sequence: 1,
  mapping: 2,
};

function *consecutivePairs<T>(iterable: Iterable<T>) {
  let first = true;
  let previous!: T;

  for (const item of iterable) {
    if (first) {
      first = false;
    } else {
      yield [previous, item];
    }
    previous = item;
  }
}

// TODO: Handle cycles, etc
export class NodeComparator {
  private readonly cache = new NestedMap<[RepresentationNode, RepresentationNode], number | null>(
    () => new WeakMap(),
    () => new WeakMap(),
  );

  private consecutiveCompare(nodes: RepresentationNode[], callback: (n: number) => boolean) {
    for (const [a, b] of consecutivePairs(nodes)) {
      const result = this.compare(a, b);
      if (!callback(result)) return false;
    }
    return true;
  }

  equals(...nodes: RepresentationNode[]) {
    return this.consecutiveCompare(nodes, n => n === 0);
  }

  compare(a: RepresentationNode, b: RepresentationNode): number {
    if (a === b) return 0;

    if (a.kind !== b.kind) return KIND_INDEX[a.kind] - KIND_INDEX[b.kind];
    if (a.tag !== b.tag) return cmpStringsByCodepoint(a.tag, b.tag);

    if (a.kind === 'scalar') return cmpStringsByCodepoint(a.content, (b as RepresentationScalar).content);
    if (a.size !== b.size) return a.size - b.size;

    let cached = this.cache.get(a, b);
    if (cached === undefined) cached = this.cache.get(b, a);

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
