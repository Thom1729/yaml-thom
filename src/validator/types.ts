import type { RepresentationNode } from '@/nodes';

export type OneOrMore<T> = T | [T, ...T[]];

export interface Validator {
  kind?: OneOrMore<'scalar' | 'sequence' | 'mapping'>;
  tag?: OneOrMore<string>;

  const?: RepresentationNode;

  minLength?: bigint;

  items?: Validator;
}
