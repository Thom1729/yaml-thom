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
} from './tags';

import {
  objectHasOwn, Y,
} from '@/util';

import { NodeComparator } from '@/nodes/equality';

export interface ComposeOptions {
  schema?: Schema;
}

const DEFAULT_COMPOSE_OPTIONS = {
  schema: coreSchema,
};

export function compose(document: SerializationNode, options: ComposeOptions = {}): RepresentationNode {
  const { schema } = {...DEFAULT_COMPOSE_OPTIONS, ...options };

  const unAliased = link(document);

  resolve(unAliased, schema);
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
      const result = new RepresentationMapping<SerializationTag, UnresolvedNode>(node.tag, []);
      setAnchor(node, result);
      for (const [key, value] of node) {
        result.content.push([rec(key), rec(value)]);
      }
      return result;
    }
  })(node);
}

// Resolve tags, canonicalize scalars, and sort mappings.
function resolve(node: UnresolvedNode, schema: Schema): asserts node is RepresentationNode {
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
      if (!objectHasOwn(CORE_TAGS, node.tag)) throw new TypeError(`Unrecognized tag ${node.tag}`);
      const canonicalContent = CORE_TAGS[node.tag].canonicalForm(node.content);
      if (canonicalContent === null) throw new Error(`Can't canonicalize ${node.tag} ${node.content}`);

      node.content = canonicalContent;
      
    } else if (node.kind === 'sequence') {
      for (const child of node) rec(child);
    } else {
      for (const [key, ] of node) rec(key);
      node.content.sort((a, b) => comparator.compare(a[0] as RepresentationNode, b[0] as RepresentationNode));
      for (const [, value] of node) rec(value);
    }
  })(node);
}

// export function compose(document: SerializationNode, options: ComposeOptions = {}): RepresentationNode {
//   const { schema } = {...DEFAULT_COMPOSE_OPTIONS, ...options };
//   return new CompositionOperation(schema).composeNode(document);
// }

// class CompositionOperation {
//   readonly schema: Schema;
//   readonly anchoredNodes = new Map<string, RepresentationNode>();
//   readonly comparator = new NodeComparator();

//   constructor(schema: Schema) {
//     this.schema = schema;
//   }

//   setAnchor(node: SerializationValueNode, ret: RepresentationNode) {
//     if (node.anchor !== null) {
//       this.anchoredNodes.set(node.anchor, ret);
//     }
//   }

//   getTag(node: SerializationValueNode) {
//     if (typeof node.tag === 'string') {
//       return node.tag;
//     } else {
//       const resolved = this.schema.resolveNode(node as UnresolvedSerializationNode);
//       if (resolved !== null) {
//         return resolved;
//       } else {
//         throw new Error(`could not resolve tag`);
//       }
//     }
//   }

//   composeNode(
//     node: SerializationNode,
//     ancestors: readonly RepresentationNode[] = [],
//     forbiddenAncestors: readonly RepresentationNode[] = [],
//   ): RepresentationNode {
//     if (node.kind === 'alias') {
//       const target = this.anchoredNodes.get(node.alias);
//       if (target === undefined) throw new Error(`Unknown anchor ${node.alias}.`);
//       else if (forbiddenAncestors.includes(target)) throw new Error(`Mapping is ill-founded`);

//       return target;
//     }

//     const tag = this.getTag(node);

//     if (node.kind === 'scalar') {
//       if (!objectHasOwn(CORE_TAGS, tag)) throw new TypeError(`Unrecognized tag ${tag}`);
//       const canonicalContent = CORE_TAGS[tag].canonicalForm(node.content);
//       if (canonicalContent === null) throw new Error(`Can't canonicalize ${tag} ${node.content}`);

//       const ret = new RepresentationScalar(tag, canonicalContent);
//       this.setAnchor(node, ret);
//       return ret;
//     } else if (node.kind === 'sequence') {
//       const ret = new RepresentationSequence<string, RepresentationNode>(tag, []);
//       this.setAnchor(node, ret);
//       const nextAncestors = [...ancestors, ret];
//       for (const child of node) {
//         ret.content.push(this.composeNode(child, nextAncestors, forbiddenAncestors));
//       }
//       return ret;
//     } else {
//       const ret = new RepresentationMapping(tag, []);
//       this.setAnchor(node, ret);
//       const nextAncestors = [...ancestors, ret];
//       const nextForbidden = [...forbiddenAncestors, ...nextAncestors];
//       const pairs = Array.from(node).map(([key, value]) =>
//         [this.composeNode(key, nextAncestors, nextForbidden), value] as const
//       );
//       pairs.sort((a,b) => this.comparator.compare(a[0], b[0]));
//       for (const [key, value] of pairs) {
//         ret.content.push([
//           key,
//           this.composeNode(value, nextAncestors, forbiddenAncestors),
//         ]);
//       }
//       // for (const [key, value] of node) {
//       //   ret.content.push([
//       //     this.composeNode(key, nextComposingMappings),
//       //     this.composeNode(value, composingMappings),
//       //   ]);
//       // }
//       return ret;
//     }
//   }
// }
