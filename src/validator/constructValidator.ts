import type { Validator, OneOrMore } from './types';
import type { RepresentationNode } from '@/nodes';

import { extractStringMap } from '@/nodes';
import { defaultConstructor } from '@/constructor';
import { isArray, assertEnum, assertString, assertBigInt } from '@/util';

function assertMaybeArray<T, U extends T>(
  value: OneOrMore<T>,
  assertion: (value: T) => asserts value is U,
): asserts value is OneOrMore<U> {
  if (isArray(value)) {
    if (value.length === 0) throw new TypeError();
    for (const item of value) {
      assertion(item);
    }
  } else {
    assertion(value);
  }
}

export function constructValidator(node: RepresentationNode): Validator {
  const x = extractStringMap(node, ['kind?', 'tag?', 'const?', 'minLength?', 'items?']);

  const ret: Validator = {};

  if (x.kind !== undefined) {
    const kind = defaultConstructor(x.kind);
    assertMaybeArray(kind, assertEnum(['scalar', 'sequence', 'mapping']));
    ret.kind = kind;
  }

  if (x.tag !== undefined) {
    const tag = defaultConstructor(x.tag);
    assertMaybeArray(tag, assertString);
    ret.tag = tag;
  }

  if (x.const !== undefined) {
    ret.const = x.const;
  }

  if (x.minLength !== undefined) {
    const minLength = defaultConstructor(x.minLength);
    assertBigInt(minLength);
    ret.minLength = minLength;
  }

  if (x.items !== undefined) {
    ret.items = constructValidator(x.items);
  }

  return ret;
}
