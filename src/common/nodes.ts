import { zip } from "../util";

export class Alias {
  readonly kind = 'alias';
  alias: string;

  constructor(alias: string) {
    this.alias = alias;
  }
}

abstract class ValueNode<TagType> {
  tag: TagType;

  constructor(tag: TagType) {
    this.tag = tag;
  }
}

abstract class Scalar<TagType> extends ValueNode<TagType> {
  readonly kind = 'scalar';
  content: string;

  constructor(tag: TagType, content: string) {
    super(tag);
    this.content = content;
  }
}

abstract class Sequence<TagType, NodeType> extends ValueNode<TagType> {
  readonly kind = 'sequence';
  content: NodeType[];

  constructor(tag: TagType, content: Iterable<NodeType>) {
    super(tag);
    this.content = Array.from(content);
  }

  *[Symbol.iterator]() {
    yield* this.content;
  }

  get size() { return this.content.length; }
}

export class SerializationMapping extends ValueNode<SerializationTag> {
  readonly kind = 'mapping';
  content: (readonly [SerializationNode, SerializationNode])[];

  anchor?: string;

  constructor(tag: SerializationTag, content: Iterable<readonly [SerializationNode, SerializationNode]>) {
    super(tag);
    this.content = Array.from(content);
  }

  *[Symbol.iterator]() {
    yield* this.content;
  }

  get size() { return this.content.length; }
}

export class SerializationScalar extends Scalar<SerializationTag> {
  anchor?: string;
}
export class SerializationSequence extends Sequence<SerializationTag, SerializationNode> {
  anchor?: string;
}

export type SerializationValueNode =
  | SerializationScalar
  | SerializationSequence
  | SerializationMapping;

export type SerializationNode = SerializationValueNode | Alias;

const QUESTION: unique symbol = Symbol.for('?');
const EXCLAMATION: unique symbol = Symbol.for('!');

export const NonSpecificTag = {
  question: QUESTION,
  exclamation: EXCLAMATION,
} as const;

export type NonSpecificTag = (typeof NonSpecificTag)[keyof typeof NonSpecificTag];
export type SerializationTag = string | NonSpecificTag;

export class RepresentationScalar extends Scalar<string> {}
export class RepresentationSequence extends Sequence<string, RepresentationNode> {}

export class RepresentationMapping extends ValueNode<string> {
  readonly kind = 'mapping';
  content: (readonly [RepresentationNode, RepresentationNode])[];

  constructor(tag: string, content: Iterable<readonly [RepresentationNode, RepresentationNode]>) {
    super(tag);
    this.content = Array.from(content);
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
    // throw new Error(`key not found`);
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

export function equals(a: RepresentationNode, b: RepresentationNode) {
  if (a === b) return true;

  if (a.tag !== b.tag) return false;

  if (a.kind === "scalar") {
    if (b.kind !== "scalar") return false;
    if (a.content !== b.content) return false;
  } else if (a.kind === "sequence") {
    if (b.kind !== "sequence") return false;
    if (a.size !== b.size) return false;

    for (const [x, y] of zip(a, b)) {
      if (!equals(x, y)) return false;
    }
  } else if (a.kind === "mapping") {
    if (b.kind !== "mapping") return false;
    if (a.size !== b.size) return false;

    for (const [[aKey, aValue], [bKey, bValue]] of zip(a, b)) {
      if (!equals(aKey, bKey)) return false;
      if (!equals(aValue, bValue)) return false;
    }
  }

  return true;
}
