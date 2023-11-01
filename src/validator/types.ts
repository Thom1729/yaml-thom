import type {
  RepresentationNode, RepresentationScalar, RepresentationSequence, RepresentationMapping,
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

  properties?: readonly (readonly [RepresentationNode, Validator])[];
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
};

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
  'mapping': RepresentationMapping<T['tag']>,
}[T['kind']];
