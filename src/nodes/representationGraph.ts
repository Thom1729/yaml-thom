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
}

export class RepresentationSequence<
  TagType extends SerializationTag = string,
  ItemType extends UnresolvedNode = RepresentationNode,
> extends ValueNode<TagType, ItemType[]> {
  readonly kind = 'sequence';

  constructor(
    tag: TagType,
    content: Iterable<ItemType> = [],
  ) {
    super(tag, Array.from(content));
  }

  *[Symbol.iterator]() {
    yield* this.content;
  }

  get size() { return this.content.length; }

  get(index: number) {
    return this.content[index];
  }
}

export class RepresentationMapping<
  TagType extends SerializationTag = string,
  PairType extends readonly [UnresolvedNode, UnresolvedNode] = readonly [RepresentationNode, RepresentationNode],
  in RequiredKeys extends PairType[0] = never,
> extends ValueNode<TagType, NodeMap<PairType>> {
  readonly kind = 'mapping';

  constructor(
    tag: TagType,
    content: Iterable<PairType> = [],
    comparator: NodeComparator | boolean = true,
  ) {
    super(tag, new NodeMap<PairType>(content, comparator));
  }

  *[Symbol.iterator]() {
    yield* this.content;
  }

  get size() { return this.content.size; }

  has(key: PairType[0]) {
    return this.content.has(key);
  }

  get<KeyType extends RequiredKeys>(
    key: KeyType,
    comparator?: NodeComparator,
  ): Get<PairType, KeyType>;
  get<KeyType extends PairType[0]>(
    key: KeyType,
    comparator?: NodeComparator,
  ): Get<PairType, KeyType> | undefined;

  get<KeyType extends PairType[0]>(
    key: KeyType,
    comparator?: NodeComparator,
  ) {
    return this.content.get(key, comparator) as Get<PairType, KeyType>;
  }

  merge(
    this: RepresentationMapping<TagType, readonly [RepresentationNode, RepresentationNode], never>,
    other: Iterable<readonly [RepresentationNode, RepresentationNode]>,
  ): RepresentationMapping<TagType, readonly [RepresentationNode, RepresentationNode], never> {
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
| RepresentationMapping<SerializationTag, readonly [UnresolvedNode, UnresolvedNode], never>;

export function isRepresentationNode(value: unknown): value is RepresentationNode {
  return value instanceof ValueNode;
}
