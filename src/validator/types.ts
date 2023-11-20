import type {
  RepresentationNode, RepresentationScalar, RepresentationSequence, RepresentationMapping,
  NodeMap,
} from '@/nodes';

type NodeKind = 'scalar' | 'sequence' | 'mapping';

export interface Validator {
  kind?: readonly [NodeKind, ...NodeKind[]];
  tag?: readonly [string, ...string[]];

  enum?: readonly [RepresentationNode, ...RepresentationNode[]];

  minLength?: bigint;
  maxLength?: bigint;

  items?: Validator;

  properties?: NodeMap<readonly [RepresentationNode, Validator]>;

  anyOf?: readonly Validator[];
}

type ExtractOptionalArray<TBase, TChild extends (readonly TBase[] | undefined)> =
| (Exclude<TChild, undefined> extends readonly (infer U extends TBase)[] ? U : never)
| (undefined extends TChild ? TBase : never);

type ValidatorTypes<T extends Validator> = {
  kind: ExtractOptionalArray<NodeKind, T['kind']>,
  tag: ExtractOptionalArray<string, T['tag']>,

  const: ExtractOptionalArray<unknown, T['enum']>,

  items: (
    T['items'] extends Validator
      ? ValidatorTypes<T['items']>
      : undefined
  ),

  properties: (
    T['properties'] extends NodeMap<infer PairType extends readonly [RepresentationNode, Validator]>
      ? Foo<PairType>
      : readonly [RepresentationNode, RepresentationNode]
  ),

  anyOf: T['anyOf'],
};

type Foo<T extends readonly [RepresentationNode, Validator]> =
  T extends readonly [RepresentationNode, Validator]
    ? readonly [T[0], Validated<T[1]>]
    : never
;

export type Validated<T extends Validator> = _Validated<ValidatorTypes<T>>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type _Validated<T extends ValidatorTypes<any>> =
& T['const']
& {
  'scalar': RepresentationScalar<T['tag']>,
  'sequence': RepresentationSequence<T['tag'],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    T['items'] extends ValidatorTypes<any>
      ? _Validated<T['items']>
      : RepresentationNode
  >,
  'mapping': RepresentationMapping<T['tag'],
    T['properties']
  >,
}[T['kind']]
& (T['anyOf'] extends readonly (infer U extends Validator)[]
  ? Validated<U>
  : unknown
);
