import type {
  RepresentationNode, RepresentationScalar, RepresentationSequence, RepresentationMapping,
  NodeMap,
} from '@/nodes';

// Not safe if T is an array type
export type OneOrMore<T> = T | readonly [T, ...T[]];

type NodeKind = 'scalar' | 'sequence' | 'mapping';

export interface Validator {
  kind?: OneOrMore<NodeKind>;
  tag?: OneOrMore<string>;

  const?: RepresentationNode;
  enum?: readonly RepresentationNode[];

  minLength?: bigint;
  maxLength?: bigint;

  items?: Validator;

  properties?: NodeMap<readonly [RepresentationNode, Validator]>;
}

type Default<T, U> =
| (U & Exclude<T, undefined>)
| (undefined extends T ? U : never);

type ExtractOneOrMore<T> =
  T extends readonly (infer U)[]
    ? U
    : T;

type ValidatorTypes<T extends Validator> = {
  kind: Default<ExtractOneOrMore<T['kind']>, NodeKind>,
  tag: Default<ExtractOneOrMore<T['tag']>, string>,

  const: (
    & Default<T['const'], unknown>
    & Default<ExtractOneOrMore<T['enum']>, unknown>
  ),

  items: (
    T['items'] extends Validator
      ? ValidatorTypes<T['items']>
      : undefined
  ),

  properties: (
    T['properties'] extends readonly (readonly [RepresentationNode, Validator])[]
      ? Foo<T['properties'][number]>
      : readonly [RepresentationNode, RepresentationNode]
  );
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
}[T['kind']];
