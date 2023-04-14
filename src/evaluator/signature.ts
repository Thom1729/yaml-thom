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

export function checkType<const T extends NodeTypeSpec>(type: T, node: RepresentationNode): node is NodeType<T> {
  if (type.kind !== undefined && type.kind !== node.kind) return false;
  if (type.tag !== undefined && type.tag !== node.tag) return false;

  if (type.items !== undefined) {
    if (node.kind !== 'sequence') return false;
    for (const item of node) {
      if (!checkType(type.items, item)) return false;
    }
  }

  return true;
}

export function checkArgumentTypes<const T extends readonly NodeTypeSpec[]>(types: T, nodes: readonly RepresentationNode[]): nodes is NodeArgumentsType<T> {
  for (const [t, arg] of zip(types, nodes)) {
    if (!checkType(t as NodeTypeSpec, arg as RepresentationNode)) return false;
  }
  return true;
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
    const value = evaluate(rawValue, context);
    if (!checkType(valueType, value)) throw new TypeError(`value`);

    const args = rawArgs.map(arg => evaluate(arg, context));
    if (!checkArgumentTypes(argumentTypes, args)) throw new TypeError(`arg`);

    return implementation(value, args, context, evaluate);
  };
}
