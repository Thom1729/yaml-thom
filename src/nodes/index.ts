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

export class SerializationScalar extends ValueNode<SerializationTag, string> {
  readonly kind = 'scalar';
  anchor?: string;
}

export class SerializationSequence extends ValueNode<SerializationTag, SerializationNode[]> {
  readonly kind = 'sequence';
  anchor?: string;

  *[Symbol.iterator]() {
    yield* this.content;
  }

  get size() { return this.content.length; }
}

export class SerializationMapping extends ValueNode<SerializationTag, (readonly [SerializationNode, SerializationNode])[]> {
  readonly kind = 'mapping';

  anchor?: string;

  constructor(tag: SerializationTag, content: Iterable<readonly [SerializationNode, SerializationNode]>) {
    super(tag, Array.from(content));
  }

  *[Symbol.iterator]() {
    yield* this.content;
  }

  get size() { return this.content.length; }
}

export type SerializationValueNode =
  | SerializationScalar
  | SerializationSequence
  | SerializationMapping;

export type SerializationNode = SerializationValueNode | Alias;

//////////

import { equals } from "./equality";

export class RepresentationScalar extends ValueNode<string, string> {
  readonly kind = 'scalar';
}

export class RepresentationSequence extends ValueNode<string, RepresentationNode[]> {
  readonly kind = 'sequence';

  *[Symbol.iterator]() {
    yield* this.content;
  }

  get size() { return this.content.length; }
}

export class RepresentationMapping extends ValueNode<string, (readonly [RepresentationNode, RepresentationNode])[]> {
  readonly kind = 'mapping';

  constructor(tag: string, content: Iterable<readonly [RepresentationNode, RepresentationNode]>) {
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

export type RepresentationNode =
  | RepresentationScalar
  | RepresentationSequence
  | RepresentationMapping;
