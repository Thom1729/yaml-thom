import type {
  RepresentationNode, RepresentationScalar, RepresentationSequence, RepresentationMapping,
  NodeMap, NodeSet,
} from '@/nodes';

type NodeKind = 'scalar' | 'sequence' | 'mapping';

export interface Validator {
  kind?: Set<NodeKind>;
  tag?: readonly [string, ...string[]];

  enum?: readonly [RepresentationNode, ...RepresentationNode[]];

  minLength?: bigint;
  maxLength?: bigint;

  items?: Validator;

  properties?: NodeMap<readonly [RepresentationNode, Validator]>;
  requiredProperties?: NodeSet<RepresentationNode>;

  anyOf?: readonly Validator[];
}

type ExtractOptionalArray<TBase, TChild extends (readonly TBase[] | undefined)> =
  TChild extends readonly (infer U extends TBase)[] ? U : TBase;

export type Validated<T extends Validator> =
& (T['anyOf'] extends readonly (infer U extends Validator)[]
  ? (
    U extends Validator ? Validated<U> : never
  )
  : Validated2<T>
);

type Validated2<T extends Validator> =
& ExtractOptionalArray<unknown, T['enum']>
& {
  'scalar': RepresentationScalar<
    ExtractOptionalArray<string, T['tag']>,
    string
  >,

  'sequence': RepresentationSequence<
    ExtractOptionalArray<string, T['tag']>,
    T['items'] extends Validator
      ? Validated<T['items']>
      : RepresentationNode
  >,

  'mapping': RepresentationMapping<
    ExtractOptionalArray<string, T['tag']>,
    ValidatedMappingPairs<T['properties']>,
    (T['requiredProperties'] extends NodeSet<infer RequiredKeys>
      ? (RequiredKeys & ValidatedMappingPairs<T['properties']>[0])
      : never)
  >,
}[T['kind'] extends Set<infer Kind extends NodeKind> ? Kind : NodeKind];

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
