import {
  RepresentationScalar,
  RepresentationSequence,
  RepresentationMapping,
  type SerializationNode,
  type SerializationValueNode,
  type RepresentationNode,
  NodeComparator,
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

import { CustomError, enumerate } from '@/util';

export class BaseCompositionError extends CustomError {
  node: SerializationNode;

  constructor(node: SerializationNode, message?: string) {
    super(message);
    this.node = node;
  }
}

export class AliasNonexistentError extends BaseCompositionError {
  readonly code = 'ALIAS_NONEXISTENT';
}

export class TagUnresolvableError extends BaseCompositionError {
  readonly code = 'TAG_UNRESOLVABLE';
}

export class TagUnrecognizedError extends BaseCompositionError {
  readonly code = 'TAG_UNRECOGNIZED';
}

export class ContentUncanonicalizableError extends BaseCompositionError {
  readonly code = 'CONTENT_UNCANONICALIZABLE';
}

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
      if (target === undefined) throw new AliasNonexistentError(node, `The alias ${JSON.stringify(node.alias)} does not exist`);
      return target;
    }

    const tag = typeof node.tag === 'symbol'
      ? schema.resolveNode(node as UnresolvedNodeInfo)
      : node.tag;

    if (tag === null) throw new TagUnresolvableError(node, `Could not resolve non-specific tag ${node.tag.toString()}`);

    if (node.kind === 'scalar') {
      const tagDefinition = tags[tag];
      if (tagDefinition === undefined) throw new TagUnrecognizedError(node, `The tag ${JSON.stringify(tag)} was not recognized`);

      const canonicalContent = tagDefinition.canonicalForm(node.content);
      if (canonicalContent === null) throw new ContentUncanonicalizableError(node, `Could not canonicalize scalar with tag ${JSON.stringify(tag)} and formatted content ${JSON.stringify(node.content)}`);

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
      for (const [index, [key, value]] of enumerate(resolvedKeys)) {
        key.presentation.index = index;
        result.content.pairs.push([key, rec(value)]);
      }
      result.content.pairs.sort((a, b) => comparator.compare(a[0], b[0]));
      return result;
    }
  }

  return rec(document);
}
