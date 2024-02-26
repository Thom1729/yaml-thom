import type { RepresentationNode } from '@/nodes';
import type { Annotation as RawAnnotation } from '@validators';

import { builtinValidationProvider } from '@/validator/validatorValidator';
import { extractTypedStringMap } from '@/helpers';

export interface Annotation {
  name: string,
  value: RepresentationNode,
  arguments: readonly RepresentationNode[],
}

export function validateAnnotation(
  node: RepresentationNode,
): asserts node is RawAnnotation {
  builtinValidationProvider.validate({ ref: '#annotation' }, node);
}

export function constructAnnotation(node: RawAnnotation): Annotation {
  const map = extractTypedStringMap(node);
  return {
    name: map.name.content,
    arguments: Array.from(map.arguments),
    value: map.value,
  };
}
