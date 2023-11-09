import type { SerializationTag } from './serializationTree';
import { NodeComparator } from './equality';

import { stringCodepointLength } from '@/util';

abstract class ValueNode<TagType, ContentType> {
  tag: TagType;
  content: ContentType;

  constructor(tag: TagType, content: ContentType) {
    this.tag = tag;
    this.content = content;
  }
}

export class RepresentationScalar<
  TagType extends SerializationTag = string,
  ContentType extends string = string,
> extends ValueNode<TagType, ContentType> {
  readonly kind = 'scalar';

  get size() { return stringCodepointLength(this.content); }

  clone() {
    return new RepresentationScalar(this.tag, this.content);
  }
}

export class RepresentationSequence<
  TagType extends SerializationTag = string,
  ItemType extends UnresolvedNode = RepresentationNode,
> extends ValueNode<TagType, ItemType[]> {
  readonly kind = 'sequence';

  *[Symbol.iterator]() {
    yield* this.content;
  }

  get size() { return this.content.length; }

  get(index: number) {
    return this.content[index];
  }

  map(callback: (item: ItemType) => ItemType) {
    return new RepresentationSequence(this.tag, this.content.map(callback));
  }
}

export class NodeMap<PairType extends readonly [UnresolvedNode, unknown]> {
  readonly pairs: PairType[] = [];

  constructor(
    pairs: Iterable<PairType> = [],
    comparator: NodeComparator | boolean = true,
  ) {
    for (const pair of pairs) this.pairs.push(pair);
    if (comparator && this.size > 1) {
      const c = (comparator === true) ? new NodeComparator() : comparator;
      (this.pairs as (readonly [RepresentationNode, RepresentationNode])[])
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
    k: KeyType,
    comparator?: NodeComparator,
  ): Get<PairType, KeyType> | undefined {
    const c = comparator ?? new NodeComparator();
    for (const [key, value] of this.pairs) {
      if (c.equals(k, key)) { return value as Get<PairType, KeyType>; }
    }
    return undefined;
  }
}

type Get<PairType extends readonly [UnresolvedNode, unknown], KeyType extends PairType[0]> =
  PairType extends readonly [infer PairKey, infer PairValue]
    ? (KeyType extends PairKey ? PairValue : never)
    : never
;

export class RepresentationMapping<
  TagType extends SerializationTag = string,
  PairType extends readonly [UnresolvedNode, UnresolvedNode] = readonly [RepresentationNode, RepresentationNode],
> extends ValueNode<TagType, NodeMap<PairType>> {
  readonly kind = 'mapping';

  constructor(
    tag: TagType,
    content: Iterable<PairType>,
    comparator: NodeComparator | boolean = true,
  ) {
    super(tag, new NodeMap<PairType>(content, comparator));
  }

  *[Symbol.iterator]() {
    yield* this.content;
  }

  get size() { return this.content.size; }

  get<KeyType extends PairType[0]>(
    k: KeyType,
    comparator?: NodeComparator,
  ): Get<PairType, KeyType> | null {
    return this.content.get(k, comparator) ?? null;
  }

  map(callback: (item: PairType[1]) => PairType[1]) {
    return new RepresentationMapping(this.tag, this.content.pairs.map(([key, value]) => [callback(key), callback(value)]));
  }

  merge(
    this: RepresentationMapping<TagType, readonly [RepresentationNode, RepresentationNode]>,
    other: Iterable<readonly [RepresentationNode, RepresentationNode]>,
  ): RepresentationMapping<TagType, readonly [RepresentationNode, RepresentationNode]> {
    const content: (readonly [RepresentationNode, RepresentationNode])[] = [];

    const
      a = Array.from(this),
      b = Array.from(other);

    let i = 0, j = 0;

    const comparator = new NodeComparator();

    while (true) {
      const x = a[i], y = b[j];

      if (x === undefined && y === undefined) {
        break;
      } else if (x === undefined) {
        content.push(y);
        j++;
      } else if (y === undefined) {
        content.push(x);
        i++;
      } else {
        const d = comparator.compare(x[0], y[0]);
        if (d === 0) {
          content.push(y);
          i++;
          j++;
        } else if (d < 0) {
          content.push(x);
          i++;
        } else {
          content.push(y);
          j++;
        }
      }
    }

    return new RepresentationMapping(this.tag, content, false);
  }
}

type RepresentationNodeKind = 'scalar' | 'sequence' | 'mapping';
export type RepresentationNode<Kind extends RepresentationNodeKind = RepresentationNodeKind, Tag extends SerializationTag = string> =
  | Kind extends 'scalar' ? RepresentationScalar<Tag> : never
  | Kind extends 'sequence' ? RepresentationSequence<Tag> : never
  | Kind extends 'mapping' ? RepresentationMapping<Tag> : never;

export type UnresolvedNode =
| RepresentationScalar<SerializationTag>
| RepresentationSequence<SerializationTag, UnresolvedNode>
| RepresentationMapping<SerializationTag, readonly [UnresolvedNode, UnresolvedNode]>;
