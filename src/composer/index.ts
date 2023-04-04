import {
  RepresentationScalar,
  RepresentationSequence,
  RepresentationMapping,
  type SerializationNode,
  type SerializationValueNode,
  type RepresentationNode,
  type UnresolvedSerializationNode,
} from '@/nodes';

import {
  coreSchema,
  type Schema,
} from './schema';

import {
  CORE_TAGS,
} from './tags';

import {
  objectHasOwn,
} from '@/util';

export function compose(document: SerializationNode): RepresentationNode {
  return new CompositionOperation(coreSchema).composeNode(document);
}

class CompositionOperation {
  readonly schema: Schema;
  readonly anchoredNodes = new Map<string, RepresentationNode>();

  constructor(schema: Schema) {
    this.schema = schema;
  }

  setAnchor(node: SerializationValueNode, ret: RepresentationNode) {
    if (node.anchor !== null) {
      this.anchoredNodes.set(node.anchor, ret);
    }
  }

  getTag(node: SerializationValueNode) {
    if (typeof node.tag === 'string') {
      return node.tag;
    } else {
      const resolved = this.schema.resolveNode(node as UnresolvedSerializationNode);
      if (resolved !== null) {
        return resolved;
      } else {
        throw new Error(`could not resolve tag`);
      }
    }
  }

  composeNode(node: SerializationNode): RepresentationNode {
    if (node.kind === 'alias') {
      const target = this.anchoredNodes.get(node.alias);
      if (target === undefined) throw new Error(`Unknown anchor ${node.alias}.`);

      return target;
    }

    const tag = this.getTag(node);

    if (node.kind === 'scalar') {
      if (!objectHasOwn(CORE_TAGS, tag)) throw new TypeError(`Unrecognized tag ${tag}`);
      const canonicalContent = CORE_TAGS[tag].canonicalForm(node.content);
      if (canonicalContent === null) throw new Error(`Can't canonicalize ${tag} ${node.content}`);
      
      const ret = new RepresentationScalar(tag, canonicalContent);
      this.setAnchor(node, ret);
      return ret;
    } else if (node.kind === 'sequence') {
      const ret = new RepresentationSequence(tag, []);
      this.setAnchor(node, ret);
      for (const child of node) {
        ret.content.push(this.composeNode(child));
      }
      return ret;
    } else {
      const ret = new RepresentationMapping(tag, []);
      this.setAnchor(node, ret);
      for (const [key, value] of node){
        ret.content.push([this.composeNode(key), this.composeNode(value)]);
      }
      return ret;
    }
  }
}
