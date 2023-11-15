import { NodeComparator } from './equality';
import type { UnresolvedNode } from './representationGraph';

export class NodeMap<PairType extends readonly [UnresolvedNode, unknown]> {
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

  get<KeyType extends PairType[0]>(
    key: KeyType,
    comparator?: NodeComparator,
  ): Get<PairType, KeyType> | undefined {
    const c = comparator ?? new NodeComparator();
    for (const [currentKey, currentValue] of this.pairs) {
      if (c.equals(key, currentKey)) {
        return currentValue as Get<PairType, KeyType>;
      }
    }
    return undefined;
  }

  set<K extends PairType[0]>(
    key: K,
    value: Get<PairType, K>,
    comparator?: NodeComparator,
  ) {
    const newPair = [key, value] as unknown as PairType;
    const c = comparator ?? new NodeComparator();

    for (let i = 0; i < this.pairs.length; i++) {
      const currentKey = this.pairs[i][0];
      const result = c.compare(key, currentKey);

      if (result < 0) {
        this.pairs.splice(i, 0, newPair);
        return;
      } else if (result === 0) {
        this.pairs[i] = newPair;
        return;
      }
    }

    this.pairs.push(newPair);
  }
}

export type Get<PairType extends readonly [UnresolvedNode, unknown], KeyType extends PairType[0]> =
  PairType extends readonly [infer PairKey, infer PairValue]
    ? (KeyType extends PairKey ? PairValue : never)
    : never
;
