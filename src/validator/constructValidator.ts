import type { Validator, OneOrMore } from './types';
import { assertValid } from './validate';

import {
  NodeMap, type RepresentationNode,
} from '@/nodes';

import {
  extractMapEntries, extractSeqItems, extractStringMap,
} from '@/helpers';

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

const validatorValidator = {
  kind: 'mapping',
  tag: 'tag:yaml.org,2002:map',

  // properties: new NodeMap([
  //   [str('kind'), { enum: [str('scalar')] }],
  //   [str('tag'), {}],
  //   [str('const'), {}],
  //   [str('enum'), {}],

  //   [str('minLength'), {}],
  //   [str('maxLength'), {}],

  //   [str('items'), {}],

  //   [str('properties'), {}],
  // ]),
} as const satisfies Validator;

export function constructValidator(node: RepresentationNode): Validator {
  assertValid(validatorValidator, node);

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
    ret.properties = new NodeMap(extractMapEntries(x.properties)
      .map(([key, value]) => [key, constructValidator(value)] as const)
    );
  }

  return ret;
}
