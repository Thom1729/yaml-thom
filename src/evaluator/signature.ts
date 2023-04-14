import type { RepresentationMapping, RepresentationNode } from '@/nodes';
import { zip } from '@/util';

interface NodeTypeSpec {
  kind?: 'scalar' | 'sequence' | 'mapping',
  tag?: string,
  items?: NodeTypeSpec,
}

export const specs = {
  str: { kind: 'scalar', tag: 'tag:yaml.org,2002:str' },
  null: { kind: 'scalar', tag: 'tag:yaml.org,2002:null' },
  bool: { kind: 'scalar', tag: 'tag:yaml.org,2002:bool' },
  int: { kind: 'scalar', tag: 'tag:yaml.org,2002:int' },
  float: { kind: 'scalar', tag: 'tag:yaml.org,2002:float' },

  seq: { kind: 'sequence', tag: 'tag:yaml.org,2002:seq' },
  seqOf<T extends NodeTypeSpec>(items: T) {
    return { kind: 'sequence', tag: 'tag:yaml.org,2002:seq', items } as const;
  },

  map: { kind: 'mapping', tag: 'tag:yaml.org,2002:map' },
} as const;

type NodeType<T extends NodeTypeSpec> = RepresentationNode<
  (T['kind'] extends string ? T['kind'] : 'scalar' | 'sequence' | 'mapping'),
  (T['tag'] extends string ? T['tag'] : string)
>;

type NodeArgumentsType<T extends readonly NodeTypeSpec[]> =
  T extends readonly [infer First extends NodeTypeSpec, ...(infer Rest extends readonly NodeTypeSpec[])]
    ? readonly [NodeType<First>, ...NodeArgumentsType<Rest>]
    : [];

function checkType<const T extends NodeTypeSpec>(
  node: RepresentationNode,
  type: T,
): node is NodeType<T> {
  if (type.kind !== undefined && type.kind !== node.kind) return false;
  if (type.tag !== undefined && type.tag !== node.tag) return false;

  if (type.items !== undefined) {
    if (node.kind !== 'sequence') return false;
    for (const item of node) {
      if (!checkType(item, type.items)) return false;
    }
  }

  return true;
}

function checkArgumentTypes<const T extends readonly NodeTypeSpec[]>(
  nodes: readonly RepresentationNode[],
  types: T,
): nodes is NodeArgumentsType<T> {
  for (const [arg, t] of zip(nodes, types as readonly NodeTypeSpec[])) {
    if (!checkType(arg, t)) return false;
  }
  return true;
}

export function assertType<const T extends NodeTypeSpec>(
  node: RepresentationNode,
  type: T,
): asserts node is NodeType<T> {
  if (!checkType(node, type)) throw new TypeError(`assertion failed`);
}

export function assertArgumentTypes<const T extends readonly NodeTypeSpec[]>(
  nodes: readonly RepresentationNode[],
  types: T,
): asserts nodes is NodeArgumentsType<T> {
  if (!checkArgumentTypes(nodes, types)) throw new TypeError(`assertion failed`);
}

//////////

import type { AnnotationFunction } from '.';

export function simpleAnnotation<T extends NodeTypeSpec, const U extends readonly NodeTypeSpec[]>(
  valueType: T,
  argumentTypes: U,
  implementation: (
    value: NodeType<T>,
    args: NodeArgumentsType<U>,
    context: RepresentationMapping,
    evaluate: (value: RepresentationNode, context: RepresentationMapping) => RepresentationNode,
  ) => RepresentationNode,
): AnnotationFunction {
  return (rawValue, rawArgs, context, evaluate) => {
    const args = rawArgs.map(arg => evaluate(arg, context));
    assertArgumentTypes(args, argumentTypes);

    const value = evaluate(rawValue, context);
    assertType(value, valueType);

    return implementation(value, args, context, evaluate);
  };
}
