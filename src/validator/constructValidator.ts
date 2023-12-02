import type { Validator } from './types';
import { assertValid } from './validate';

import {
  NodeMap, type RepresentationNode,
} from '@/nodes';

import {
  extractInt,
  extractMapEntries, extractSeqItems, extractTypedStringMap, str,
} from '@/helpers';

import * as V from './validatorHelpers';

import { assertNotEmpty } from '@/util';

const nodeKindValidator = {
  enum: [str('scalar'), str('sequence'), str('mapping')],
} satisfies Validator;

const validatorValidator = V.stringMapOf({
  'kind?': { anyOf: [ nodeKindValidator, V.seqOf(nodeKindValidator) ] },
  'tag?': { anyOf: [ V.str, V.seqOf(V.str) ] },
  'const?': {},
  'enum?': V.seq,

  'minLength?': V.int,
  'maxLength?': V.int,

  'items?': {},
  'properties?': V.map,
  'requiredProperties?': V.seq,
});

export function constructValidator(node: RepresentationNode): Validator {
  assertValid(validatorValidator, node);
  const x = extractTypedStringMap(node);

  const ret: Validator = {};

  if (x.kind !== undefined) {
    if (x.kind.kind === 'scalar') {
      ret.kind = new Set([x.kind.content]);
    } else {
      const kind = Array.from(x.kind).map(scalar => scalar.content);
      assertNotEmpty(kind);
      ret.kind = new Set(kind);
    }
  }

  if (x.tag !== undefined) {
    if (x.tag.kind === 'scalar') {
      ret.tag = [x.tag.content];
    } else {
      const kind = Array.from(x.tag).map(scalar => scalar.content);
      assertNotEmpty(kind);
      ret.tag = kind;
    }
  }

  if (x.const !== undefined) {
    if (x.enum !== undefined) throw new TypeError(`const and enum are exclusive`);
    ret.enum = [x.const];
  }

  if (x.enum !== undefined) {
    const items = extractSeqItems(x.enum);
    assertNotEmpty(items);
    ret.enum = items;
  }

  for (const key of ['minLength', 'maxLength'] as const) {
    const rawValue = x[key];
    if (rawValue !== undefined) {
      const value = extractInt(rawValue);
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
