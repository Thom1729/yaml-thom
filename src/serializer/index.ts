import {
  Alias,
  SerializationScalar,
  SerializationSequence,
  SerializationMapping,
  NonSpecificTag,
  canBePlainScalar,
  type SerializationNode,
  type SerializationValueNode,
  type RepresentationNode,
} from '@/nodes';

import {
  coreSchema,
  type Schema,
} from '@/composer/schema';

export interface SerializeOptions {
  schema?: Schema;
  anchorNames?: () => Generator<string>;
}

const DEFAULT_OPTIONS = {
  schema: coreSchema,
  anchorNames: function*() {
    for (let i = 0;; i++) {
      yield i.toString();
    }
  },
} satisfies Required<SerializeOptions>;

export function serialize(doc: RepresentationNode, options: SerializeOptions = {}) {
  return new SerializeOperation({
    ...DEFAULT_OPTIONS,
    ...options,
  }).serialize(doc);
}

class SerializeOperation {
  readonly options: Required<SerializeOptions>;
  readonly anchorNameGenerator: Generator<string>;
  readonly cache = new Map<RepresentationNode, SerializationValueNode>();

  constructor(options: Required<SerializeOptions>) {
    this.options = options;

    this.anchorNameGenerator = this.options.anchorNames();
  }

  serialize(node: RepresentationNode): SerializationNode {
    const cachedNode = this.cache.get(node);
    if (cachedNode !== undefined) {
      if (cachedNode.anchor === null) {
        const result = this.anchorNameGenerator.next();
        if (result.done) throw new Error(`Anchor name generator is exhausted`);
        cachedNode.anchor = result.value;
      }
      return new Alias(cachedNode.anchor);
    }

    const tag = this.unresolveTag(node);

    if (node.kind === 'scalar') {
      const ret = new SerializationScalar(tag, node.content);
      this.cache.set(node, ret);
      return ret;
    } else if (node.kind === 'sequence') {
      const ret = new SerializationSequence(tag, []);
      this.cache.set(node, ret);
      for (const child of node) {
        ret.content.push(this.serialize(child));
      }
      return ret;
    } else if (node.kind === 'mapping') {
      const ret = new SerializationMapping(tag, []);
      this.cache.set(node, ret);
      for (const [key, value] of node) {
        ret.content.push([this.serialize(key), this.serialize(value)]);
      }
      return ret;
    } else {
      throw new Error('unreachable');
    }
  }

  unresolveTag(node: RepresentationNode) {
    if (
      // Don't resolve a scalar to ? if it can't be presented as a plain scalar
      (node.kind !== 'scalar' || canBePlainScalar(node.content))
      && this.options.schema.resolveNode({ ...node, tag: NonSpecificTag.question }) === node.tag
    ) {
      return NonSpecificTag.question;
    } else if (this.options.schema.resolveNode({ ...node, tag: NonSpecificTag.exclamation }) === node.tag) {
      return NonSpecificTag.exclamation;
    } else {
      return node.tag;
    }
  }
}
