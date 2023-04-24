import { stringCodepointLength } from '@/util';

const QUESTION: unique symbol = Symbol.for('?');
const EXCLAMATION: unique symbol = Symbol.for('!');

export const NonSpecificTag = {
  question: QUESTION,
  exclamation: EXCLAMATION,
} as const;

export type NonSpecificTag = (typeof NonSpecificTag)[keyof typeof NonSpecificTag];

//////////

abstract class ValueNode<TagType, ContentType> {
  tag: TagType;
  content: ContentType;

  constructor(tag: TagType, content: ContentType) {
    this.tag = tag;
    this.content = content;
  }
}

abstract class BaseSerializationValueNode<TagType, ContentType> extends ValueNode<TagType, ContentType> {
  anchor: string | null;
  constructor(tag: TagType, content: ContentType, anchor: string | null = null) {
    super(tag, content);
    this.anchor = anchor;
  }
}

//////////

export class Alias {
  readonly kind = 'alias';
  alias: string;

  constructor(alias: string) {
    this.alias = alias;
  }
}

export type SerializationTag = string | NonSpecificTag;

export class SerializationScalar<TagType extends SerializationTag = SerializationTag> extends BaseSerializationValueNode<TagType, string> {
  readonly kind = 'scalar';
}

export class SerializationSequence<TagType extends SerializationTag = SerializationTag> extends BaseSerializationValueNode<TagType, SerializationNode[]> {
  readonly kind = 'sequence';

  *[Symbol.iterator]() {
    yield* this.content;
  }

  get size() { return this.content.length; }
}

export class SerializationMapping<TagType extends SerializationTag = SerializationTag> extends BaseSerializationValueNode<TagType, (readonly [SerializationNode, SerializationNode])[]> {
  readonly kind = 'mapping';

  constructor(tag: TagType, content: Iterable<readonly [SerializationNode, SerializationNode]>, anchor: string | null = null) {
    super(tag, Array.from(content), anchor);
  }

  *[Symbol.iterator]() {
    yield* this.content;
  }

  get size() { return this.content.length; }
}

export type SerializationValueNode<TagType extends SerializationTag = SerializationTag> =
  | SerializationScalar<TagType>
  | SerializationSequence<TagType>
  | SerializationMapping<TagType>;

export type SerializationNode = SerializationValueNode | Alias;

export type UnresolvedSerializationNode = SerializationValueNode<NonSpecificTag>;

//////////

import { NodeComparator } from './equality';

export class RepresentationScalar<TagType extends SerializationTag = string> extends ValueNode<TagType, string> {
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
  ItemType extends UnresolvedNode = RepresentationNode,
> extends ValueNode<TagType, (readonly [ItemType, ItemType])[]> {
  readonly kind = 'mapping';

  constructor(tag: TagType, content: Iterable<readonly [ItemType, ItemType]>, comparator: NodeComparator | boolean = true) {
    const pairs = Array.from(content);
    if (comparator && pairs.length > 1) {
      const c = (comparator === true) ? new NodeComparator() : comparator;
      (pairs as (readonly [RepresentationNode, RepresentationNode])[])
        .sort((a, b) => {
          const diff = c.compare(a[0], b[0]);
          if (diff === 0) throw new Error(`duplicate keys`);
          return diff;
        });
    }
    super(tag, pairs);
  }

  *[Symbol.iterator]() {
    yield* this.content;
  }

  get size() { return this.content.length; }

  get(this: RepresentationMapping, k: ItemType & RepresentationNode, comparator?: NodeComparator) {
    const c = comparator ?? new NodeComparator();
    for (const [key, value] of this.content) {
      if (c.compare(k, key) === 0) { return value; }
    }
    return null;
  }

  map(callback: (item: ItemType) => ItemType) {
    return new RepresentationMapping(this.tag, this.content.map(([key, value]) => [callback(key), callback(value)]));
  }

  merge(other: Iterable<readonly [ItemType, ItemType]>) {
    const content: (readonly [RepresentationNode, RepresentationNode])[] = [];

    const
      a = Array.from(this) as (readonly [RepresentationNode, RepresentationNode])[],
      b = Array.from(other) as (readonly [RepresentationNode, RepresentationNode])[];

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
| RepresentationMapping<SerializationTag, UnresolvedNode>;
