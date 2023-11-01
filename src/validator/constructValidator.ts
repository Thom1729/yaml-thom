import type { Validator, OneOrMore } from './types';
import { RepresentationNode, extractMapEntries, extractSeqItems } from '@/nodes';

import { extractStringMap } from '@/nodes';
import { defaultConstructor } from '@/constructor';
import { isArray, assertEnum, assertString, assertBigInt } from '@/util';

function assertMaybeArray<T, U extends T>(
  value: OneOrMore<T>,
  assertion: (value: T) => asserts value is U,
): asserts value is OneOrMore<U> {
  if (isArray(value)) {
    if (value.length === 0) throw new TypeError();
    for (const item of value as T[]) {
      assertion(item);
    }
  } else {
    assertion(value);
  }
}

export function constructValidator(node: RepresentationNode): Validator {
  const x = extractStringMap(node, [
    'kind?', 'tag?',
    'const?', 'enum?',
    'minLength?', 'maxLength?',
    'items?',
    'properties?',
  ]);

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

  if (x.enum !== undefined) {
    ret.enum = extractSeqItems(x.enum);
  }

  for (const key of ['minLength', 'maxLength'] as const) {
    const rawValue = x[key];
    if (rawValue !== undefined) {
      const value = defaultConstructor(rawValue);
      assertBigInt(value);
      ret[key] = value;
    }
  }

  if (x.items !== undefined) {
    ret.items = constructValidator(x.items);
  }

  if (x.properties !== undefined) {
    ret.properties = extractMapEntries(x.properties)
      .map(([key, value]) => [key, constructValidator(value)] as const);
  }

  return ret;
}
