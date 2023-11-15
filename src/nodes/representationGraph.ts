import type { SerializationTag } from './serializationTree';
import { NodeComparator } from './equality';
import { NodeMap, type Get } from './nodeMap';

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

export type RepresentationNode =
| RepresentationScalar
| RepresentationSequence
| RepresentationMapping;

export type UnresolvedNode =
| RepresentationScalar<SerializationTag>
| RepresentationSequence<SerializationTag, UnresolvedNode>
| RepresentationMapping<SerializationTag, readonly [UnresolvedNode, UnresolvedNode]>;
