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
  const { schema, anchorNames } = { ...DEFAULT_OPTIONS, ...options };
  const anchorNameGenerator = anchorNames();

  const cache = new Map<RepresentationNode, SerializationValueNode>();

  function unresolveTag(node: RepresentationNode) {
    if (
      // Don't resolve a scalar to ? if it can't be presented as a plain scalar
      (node.kind !== 'scalar' || canBePlainScalar(node.content))
      && schema.resolveNode({ ...node, tag: NonSpecificTag.question }) === node.tag
    ) {
      return NonSpecificTag.question;
    } else if (schema.resolveNode({ ...node, tag: NonSpecificTag.exclamation }) === node.tag) {
      return NonSpecificTag.exclamation;
    } else {
      return node.tag;
    }
  }

  function rec(node: RepresentationNode): SerializationNode {
    const x = cache.get(node);
    if (x !== undefined) {
      if (x.anchor === null) {
        const result = anchorNameGenerator.next();
        if (result.done) throw new Error(`Anchor name generator is exhausted`);
        x.anchor = result.value;
      }
      return new Alias(x.anchor);
    }

    const tag = unresolveTag(node);

    if (node.kind === 'scalar') {
      const ret = new SerializationScalar(tag, node.content);
      cache.set(node, ret);
      return ret;
    } else if (node.kind === 'sequence') {
      const ret = new SerializationSequence(tag, []);
      cache.set(node, ret);
      for (const child of node) {
        ret.content.push(rec(child));
      }
      return ret;
    } else if (node.kind === 'mapping') {
      const ret = new SerializationMapping(tag, []);
      cache.set(node, ret);
      for (const [key, value] of node) {
        ret.content.push([rec(key), rec(value)]);
      }
      return ret;
    } else {
      throw new Error('unreachable');
    }
  }

  return rec(doc);
}
