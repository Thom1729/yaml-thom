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

//////////

export class Alias {
  readonly kind = 'alias';
  alias: string;

  constructor(alias: string) {
    this.alias = alias;
  }
}

export type SerializationTag = string | NonSpecificTag;

export class SerializationScalar<TagType extends SerializationTag = SerializationTag> extends ValueNode<TagType, string> {
  readonly kind = 'scalar';
  anchor?: string;
}

export class SerializationSequence<TagType extends SerializationTag = SerializationTag> extends ValueNode<TagType, SerializationNode[]> {
  readonly kind = 'sequence';
  anchor?: string;

  *[Symbol.iterator]() {
    yield* this.content;
  }

  get size() { return this.content.length; }
}

export class SerializationMapping<TagType extends SerializationTag = SerializationTag> extends ValueNode<TagType, (readonly [SerializationNode, SerializationNode])[]> {
  readonly kind = 'mapping';

  anchor?: string;

  constructor(tag: TagType, content: Iterable<readonly [SerializationNode, SerializationNode]>) {
    super(tag, Array.from(content));
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

import { equals } from './equality';

export class RepresentationScalar<TagType extends string = string> extends ValueNode<TagType, string> {
  readonly kind = 'scalar';
}

export class RepresentationSequence<TagType extends string = string> extends ValueNode<TagType, RepresentationNode[]> {
  readonly kind = 'sequence';

  *[Symbol.iterator]() {
    yield* this.content;
  }

  get size() { return this.content.length; }
}

export class RepresentationMapping<TagType extends string = string> extends ValueNode<TagType, (readonly [RepresentationNode, RepresentationNode])[]> {
  readonly kind = 'mapping';

  constructor(tag: TagType, content: Iterable<readonly [RepresentationNode, RepresentationNode]>) {
    super(tag, Array.from(content));
  }

  *[Symbol.iterator]() {
    yield* this.content;
  }

  get size() { return this.content.length; }

  get(k: RepresentationNode) {
    for (const [key, value] of this.content) {
      if (equals(k, key)) { return value; }
    }
    return null;
  }

  merge(other: Iterable<[RepresentationNode, RepresentationNode]>) {
    const content: (readonly [RepresentationNode, RepresentationNode])[] = [...other, ...this.content];
    return new RepresentationMapping(this.tag, content);
  }
}

export type RepresentationNode<TagType extends string = string> =
  | RepresentationScalar<TagType>
  | RepresentationSequence<TagType>
  | RepresentationMapping<TagType>;
