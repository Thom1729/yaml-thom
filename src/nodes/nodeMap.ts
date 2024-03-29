import { NodeComparator } from './equality';
import type { RepresentationNode } from './representationGraph';
import { cmpFirst, insertSortedExclusive, unique, interleave } from '@/util';

export class NodeMap<const PairType extends readonly [RepresentationNode, unknown]> {
  static mergePairs<TPairType extends readonly [RepresentationNode, RepresentationNode]>(
    iterables: Iterable<TPairType>[]
  ): Iterable<TPairType> {
    const comparator = new NodeComparator();
    const cmp = cmpFirst(comparator.compare.bind(comparator));

    return unique(interleave(iterables, cmp), cmp);
  }

  readonly pairs: PairType[] = [];

  constructor(
    pairs?: Iterable<PairType>,
    comparator: NodeComparator | boolean = true,
  ) {
    if (pairs !== undefined) {
      for (const pair of pairs) {
        this.pairs.push(pair);
      }
    }

    if (comparator && this.size > 1) {
      const c = (comparator === true) ? new NodeComparator() : comparator;
      this.pairs
        .sort((a, b) => {
          const diff = c.compare(a[0], b[0]);
          if (diff === 0) throw new Error(`duplicate keys`);
          return diff;
        });
    }
  }

  *[Symbol.iterator]() {
    yield* this.pairs;
  }

  get size() { return this.pairs.length; }

  *keys(): Iterable<PairType[0]> {
    for (const [key] of this.pairs) yield key;
  }

  *values(): Iterable<PairType[1]> {
    for (const [, value] of this.pairs) yield value;
  }

  private _findPair(key: PairType[0], comparator?: NodeComparator) {
    const c = comparator ?? new NodeComparator();
    for (const pair of this.pairs) {
      if (c.equals(key, pair[0])) {
        return pair;
      }
    }
    return undefined;
  }

  has(key: PairType[0], comparator?: NodeComparator) {
    return this._findPair(key, comparator) !== undefined;
  }

  get<KeyType extends PairType[0]>(
    key: KeyType,
    comparator?: NodeComparator,
  ): Get<PairType, KeyType> | undefined {
    return this._findPair(key, comparator)?.[1] as Get<PairType, KeyType> | undefined;
  }

  set<K extends PairType[0]>(
    key: K,
    value: Get<PairType, K>,
    comparator?: NodeComparator,
  ) {
    const newPair = [key, value] as unknown as PairType;
    const c = comparator ?? new NodeComparator();

    insertSortedExclusive(this.pairs, newPair, cmpFirst(c.compare.bind(c)));
  }
}

export class NodeSet<T extends RepresentationNode> {
  readonly map = new NodeMap<readonly [T, undefined]>();

  constructor(items?: Iterable<T>) {
    if (items !== undefined) {
      for (const item of items) {
        this.add(item);
      }
    }
  }

  *[Symbol.iterator]() {
    for (const [key] of this.map) {
      yield key;
    }
  }

  get size() { return this.map.size; }

  has(key: T, comparator?: NodeComparator) {
    return this.map.has(key, comparator);
  }

  add(key: T, comparator?: NodeComparator) {
    this.map.set(key, undefined, comparator);
  }
}

export type Get<
  PairType extends readonly [RepresentationNode, unknown],
  KeyType extends PairType[0],
> =
  PairType extends readonly [infer PairKey, infer PairValue]
    ? (KeyType extends PairKey ? PairValue : never)
    : never
;
