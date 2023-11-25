import {
  RepresentationScalar,
  RepresentationSequence,
  RepresentationMapping,
  type SerializationNode,
  type SerializationValueNode,
  type RepresentationNode,
  SerializationTag,
  UnresolvedNode,
} from '@/nodes';

import {
  coreSchema,
  type Schema,
} from './schema';

import {
  CORE_TAGS,
  type TagDefinitions,
} from './tags';

import {
  Y,
} from '@/util';

import { NodeComparator } from '@/nodes';

export interface ComposeOptions {
  schema?: Schema;
  tags?: TagDefinitions,
}

const DEFAULT_COMPOSE_OPTIONS = {
  schema: coreSchema,
  tags: CORE_TAGS,
};

export function compose(document: SerializationNode, options: ComposeOptions = {}): RepresentationNode {
  const { schema, tags } = {...DEFAULT_COMPOSE_OPTIONS, ...options };

  const unAliased = link(document);

  resolve(unAliased, schema, tags);
  return unAliased;
}

// Link aliases to anchors, converting a serialization tree to an unresolved representation graph.
function link(node: SerializationNode) {
  const anchoredNodes = new Map<string, UnresolvedNode>();
  function setAnchor(node: SerializationValueNode, ret: UnresolvedNode) {
    if (node.anchor !== null) anchoredNodes.set(node.anchor, ret);
  }

  return Y<UnresolvedNode, [SerializationNode]>((rec, node) => {
    if (node.kind === 'alias') {
      const target = anchoredNodes.get(node.alias);
      if (target === undefined) throw new Error(`Unknown anchor ${node.alias}.`);
      return target;
    }

    if (node.kind === 'scalar') {
      const result = new RepresentationScalar(node.tag, node.content);
      setAnchor(node, result);
      return result;
    } else if (node.kind === 'sequence') {
      const result = new RepresentationSequence<SerializationTag, UnresolvedNode>(node.tag, []);
      setAnchor(node, result);
      for (const item of node) {
        result.content.push(rec(item));
      }
      return result;
    } else {
      const result = new RepresentationMapping<SerializationTag, readonly [UnresolvedNode, UnresolvedNode]>(node.tag, []);
      setAnchor(node, result);
      for (const [key, value] of node) {
        result.content.pairs.push([rec(key), rec(value)]);
      }
      return result;
    }
  })(node);
}

// Resolve tags, canonicalize scalars, and sort mappings.
function resolve(
  node: UnresolvedNode,
  schema: Schema,
  tags: TagDefinitions,
): asserts node is RepresentationNode {
  const comparator = new NodeComparator();
  const composedNodes = new Set<UnresolvedNode>();

  Y<void, [UnresolvedNode]>((rec, node) => {
    if (composedNodes.has(node)) return node;

    composedNodes.add(node);

    if (typeof node.tag === 'symbol') {
      const resolved = schema.resolveNode(node);
      if (resolved !== null) {
        node.tag = resolved;
      } else {
        throw new Error(`could not resolve tag`);
      }
    }

    if (node.kind === 'scalar') {
      const tagDefinition = tags[node.tag];
      if (tagDefinition === undefined) throw new TypeError(`Unrecognized tag ${node.tag}`);

      const canonicalContent = tagDefinition.canonicalForm(node.content);
      if (canonicalContent === null) throw new Error(`Can't canonicalize ${node.tag} ${node.content}`);

      node.content = canonicalContent;
      
    } else if (node.kind === 'sequence') {
      for (const child of node) rec(child);
    } else {
      for (const [key, ] of node) rec(key);
      node.content.pairs.sort((a, b) => comparator.compare(a[0] as RepresentationNode, b[0] as RepresentationNode));
      for (const [, value] of node) rec(value);
    }
  })(node);
}
