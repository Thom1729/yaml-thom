import type {
  RepresentationNode,
  RepresentationScalar,
  RepresentationSequence,
  RepresentationMapping,
} from '@/nodes';
import { zip } from '@/util';

import type { Evaluator } from '.';

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

type NodeType<T extends NodeTypeSpec> = _NodeType<Normalized<T>>;

type Normalized<T extends NodeTypeSpec> = {
  kind: T['kind'] extends string ? T['kind'] : 'scalar' | 'sequence' | 'mapping',
  tag: T['tag'] extends string ? T['tag'] : string,
  items: Normalized<T['items'] extends NodeTypeSpec ? T['items'] : NodeTypeSpec>,
};

type _NodeType<T extends Normalized<NodeTypeSpec>> =
| ('scalar' extends T['kind'] ? RepresentationScalar<T['tag']> : never)
| ('sequence' extends T['kind'] ? RepresentationSequence<T['tag'], _NodeType<T['items']>> : never)
| ('mapping' extends T['kind'] ? RepresentationMapping<T['tag']> : never);

type NodeArgumentsType<T extends readonly NodeTypeSpec[]> =
  T extends readonly [infer First extends NodeTypeSpec, ...(infer Rest extends readonly NodeTypeSpec[])]
    ? readonly [NodeType<First>, ...NodeArgumentsType<Rest>]
    : [];

// TODO: return specifics
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

export function assertType<const T extends NodeTypeSpec>(
  node: RepresentationNode,
  type: T,
): asserts node is NodeType<T> {
  if (!checkType(node, type)) throw new TypeError(`expected ${JSON.stringify(type)}, got ${node.kind} tagged ${node.tag}`);
}

export function assertArgumentTypes<const T extends readonly NodeTypeSpec[]>(
  nodes: readonly RepresentationNode[],
  types: T,
): asserts nodes is NodeArgumentsType<T> {
  for (const [arg, t] of zip(nodes, types as readonly NodeTypeSpec[])) {
    assertType(arg, t);
  }
}

//////////

import type { AnnotationFunction } from '.';

export function simpleAnnotation<T extends NodeTypeSpec, const U extends readonly NodeTypeSpec[]>(
  valueType: T,
  argumentTypes: U,
  implementation: (
    this: Evaluator,
    value: NodeType<T>,
    args: NodeArgumentsType<U>,
    context: RepresentationMapping,
  ) => RepresentationNode,
): AnnotationFunction {
  return function (rawValue, rawArgs, context) {
    const args = rawArgs.map(arg => this.evaluate(arg, context));
    assertArgumentTypes(args, argumentTypes);

    const value = this.evaluate(rawValue, context);
    assertType(value, valueType);

    return implementation.call(this, value, args, context);
  };
}
