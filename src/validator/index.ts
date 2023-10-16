export * from './constructValidator';
export * from './validate';

import type { RepresentationNode } from '@/nodes';

export interface Validator {
  kind?: 'scalar' | 'sequence' | 'mapping';
  tag?: string;

  const?: RepresentationNode;

  minLength?: bigint;

  items?: Validator;
}
