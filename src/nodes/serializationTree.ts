import type { NonSpecificTag } from './tags';
import type { ScalarStyle } from './style';

export type SerializationTag = string | NonSpecificTag;

export class Alias {
  readonly kind = 'alias';
  alias: string;

  constructor(alias: string) {
    this.alias = alias;
  }
}

abstract class BaseSerializationValueNode<TagType, ContentType, PresentationType extends object = object> {
  tag: TagType;
  content: ContentType;
  anchor: string | null;
  presentation: PresentationType;

  constructor(
    tag: TagType,
    content: ContentType,
    anchor: string | null = null,
    presentation?: PresentationType,
  ) {
    this.tag = tag;
    this.content = content;
    this.anchor = anchor;
    this.presentation = presentation ?? {} as PresentationType;
  }
}

export interface SerializationScalarPresentation {
  style?: ScalarStyle;
}

export class SerializationScalar<
  TagType extends SerializationTag = SerializationTag
> extends BaseSerializationValueNode<TagType, string, SerializationScalarPresentation> {
  readonly kind = 'scalar';
}

export class SerializationSequence<
  TagType extends SerializationTag = SerializationTag
> extends BaseSerializationValueNode<TagType, SerializationNode[]> {
  readonly kind = 'sequence';

  *[Symbol.iterator]() {
    yield* this.content;
  }

  get size() { return this.content.length; }
}

export class SerializationMapping<
  TagType extends SerializationTag = SerializationTag
> extends BaseSerializationValueNode<TagType, (readonly [SerializationNode, SerializationNode])[]> {
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
