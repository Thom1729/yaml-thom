import type {
  RepresentationNode, RepresentationScalar, RepresentationSequence, RepresentationMapping,
  NodeMap, NodeSet,
} from '@/nodes';

type NodeKind = 'scalar' | 'sequence' | 'mapping';

export interface Validator {
  kind?: Set<NodeKind>;
  tag?: Set<string>;

  enum?: NodeSet<RepresentationNode>;

  minLength?: bigint;
  maxLength?: bigint;

  items?: Validator;

  properties?: NodeMap<readonly [RepresentationNode, Validator]>;
  requiredProperties?: NodeSet<RepresentationNode>;

  anyOf?: readonly Validator[];
}

type ExtractSet<TBase, TChild extends Set<TBase> | undefined> =
  TChild extends Set<infer U> ? U : TBase;

export type Validated<T extends Validator> =
& (T['anyOf'] extends readonly (infer U extends Validator)[]
  ? (
    U extends Validator ? Validated<U> : never
  )
  : Validated2<T>
);

type Validated2<T extends Validator> =
& (T['enum'] extends NodeSet<infer U> ? U : unknown)
& {
  'scalar': RepresentationScalar<
    ExtractSet<string, T['tag']>,
    string
  >,

  'sequence': RepresentationSequence<
    ExtractSet<string, T['tag']>,
    T['items'] extends Validator
      ? Validated<T['items']>
      : RepresentationNode
  >,

  'mapping': RepresentationMapping<
    ExtractSet<string, T['tag']>,
    ValidatedMappingPairs<T['properties']>,
    (T['requiredProperties'] extends NodeSet<infer RequiredKeys>
      ? (RequiredKeys & ValidatedMappingPairs<T['properties']>[0])
      : never)
  >,
}[ExtractSet<NodeKind, T['kind']>];

type ValidatedMappingPairs<
  TProperties extends Validator['properties'],
> =
  TProperties extends NodeMap<infer PairType>
    ? (
      PairType extends readonly [infer K extends RepresentationNode, infer V extends Validator]
        ? readonly [K, Validated<V>]
        : never
    )
    : readonly [RepresentationNode, RepresentationNode];
