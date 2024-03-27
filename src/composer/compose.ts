import {
  RepresentationScalar,
  RepresentationSequence,
  RepresentationMapping,
  type SerializationNode,
  type SerializationValueNode,
  type RepresentationNode,
} from '@/nodes';

import {
  coreSchema,
  UnresolvedNodeInfo,
  type Schema,
} from './schema';

import {
  CORE_TAGS,
  type TagDefinitions,
} from './tags';

import { NodeComparator } from '@/nodes';

export interface ComposeOptions {
  schema: Schema;
  tags: TagDefinitions,
}

const DEFAULT_COMPOSE_OPTIONS: ComposeOptions = {
  schema: coreSchema,
  tags: CORE_TAGS,
};

export function compose(
  document: SerializationNode,
  options: Partial<ComposeOptions> = {},
): RepresentationNode {
  const { schema, tags } = {...DEFAULT_COMPOSE_OPTIONS, ...options };

  const comparator = new NodeComparator();
  const anchoredNodes = new Map<string, RepresentationNode>();
  function setAnchor(
    serializationNode: SerializationValueNode,
    representationNode: RepresentationNode,
  ) {
    if (serializationNode.anchor !== null) {
      anchoredNodes.set(serializationNode.anchor, representationNode);
    }
  }

  function rec(node: SerializationNode): RepresentationNode {
    if (node.kind === 'alias') {
      const target = anchoredNodes.get(node.alias);
      if (target === undefined) throw new Error(`Unknown anchor ${node.alias}.`);
      return target;
    }

    const tag = typeof node.tag === 'symbol'
      ? schema.resolveNode(node as UnresolvedNodeInfo)
      : node.tag;

    if (tag === null) throw new Error('could not resolve tag');

    if (node.kind === 'scalar') {
      const tagDefinition = tags[tag];
      if (tagDefinition === undefined) throw new TypeError(`Unrecognized tag ${tag}`);

      const canonicalContent = tagDefinition.canonicalForm(node.content);
      if (canonicalContent === null) throw new Error(`Can't canonicalize ${tag} ${node.content}`);

      const result = new RepresentationScalar(tag, canonicalContent);
      setAnchor(node, result);
      return result;
    } else if (node.kind === 'sequence') {
      const result = new RepresentationSequence(tag);
      setAnchor(node, result);
      for (const child of node) {
        result.content.push(rec(child));
      }
      return result;
    } else {
      const result = new RepresentationMapping(tag);
      setAnchor(node, result);
      const resolvedKeys = Array.from(node).map(([key, value]) => [rec(key), value] as const);
      for (const [key, value] of resolvedKeys) {
        result.content.pairs.push([key, rec(value)]);
      }
      result.content.pairs.sort((a, b) => comparator.compare(a[0], b[0]));
      return result;
    }
  }

  return rec(document);
}
