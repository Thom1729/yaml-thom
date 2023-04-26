import {
  Alias,
  SerializationScalar,
  SerializationSequence,
  SerializationMapping,
  NonSpecificTag,
  type SerializationNode,
  type SerializationValueNode,
  type RepresentationNode,
  // type SerializationTag,
} from '@/nodes';

import {
  coreSchema,
  type Schema,
} from '@/composer/schema';

import { canBePlainScalar } from '@/presenter';

export interface ComposeOptions {
  schema?: Schema;
}

export function serialize(doc: RepresentationNode, options: ComposeOptions = {}) {
  const schema = options.schema ?? coreSchema;
  const cache = new Map<RepresentationNode, SerializationValueNode>();
  let anchorIndex = 0;

  function unresolveTag(node: RepresentationNode) {
    if (
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
        x.anchor = (anchorIndex++).toString();
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
