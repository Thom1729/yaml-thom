import type { Validator } from './types';
import { assertValid } from './validate';
import type { Validator as ValidatedValidator } from './generated';

import {
  NodeMap, NodeSet, type RepresentationNode,
} from '@/nodes';

import {
  extractInt,
  extractMapEntries, extractSeqItems, extractTypedStringMap, str,
} from '@/helpers';

import * as V from './validatorHelpers';

import { assertNotEmpty } from '@/util';

const nodeKindValidator = {
  enum: new NodeSet([str('scalar'), str('sequence'), str('mapping')]),
} satisfies Validator;

const validatorValidator = V.stringMapOf({
  'id?': V.str,
  'name?': V.str,

  'kind?': { anyOf: [ nodeKindValidator, V.seqOf(nodeKindValidator) ] },
  'tag?': { anyOf: [ V.str, V.seqOf(V.str) ] },
  'const?': {},
  'enum?': V.seq,

  'minLength?': V.int,
  'maxLength?': V.int,

  'items?': {},
  'properties?': V.map,
  'additionalProperties?': {},
  'requiredProperties?': V.seq,

  'anyOf?': V.seq,
});

export function validateValidator(
  validator: RepresentationNode,
): asserts validator is ValidatedValidator {
  assertValid(validatorValidator, validator);
}

export function constructValidator(
  node: RepresentationNode,
  cache?: Map<RepresentationNode, Validator>,
): Validator {
  cache ??= new Map();

  const cached = cache.get(node);
  if (cached !== undefined) return cached;

  validateValidator(node);
  const x = extractTypedStringMap(node);

  const ret: Validator = {};
  cache.set(node, ret);

  if (x.id !== undefined) {
    ret.id = x.id.content;
  }

  if (x.name !== undefined) {
    ret.name = x.name.content;
  }

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
      ret.tag = new Set([x.tag.content]);
    } else {
      const kind = Array.from(x.tag).map(scalar => scalar.content);
      assertNotEmpty(kind);
      ret.tag = new Set(kind);
    }
  }

  if (x.const !== undefined) {
    if (x.enum !== undefined) throw new TypeError(`const and enum are exclusive`);
    ret.enum = new NodeSet([x.const]);
  }

  if (x.enum !== undefined) {
    const items = extractSeqItems(x.enum);
    assertNotEmpty(items);
    ret.enum = new NodeSet(items);
  }

  for (const key of ['minLength', 'maxLength'] as const) {
    const rawValue = x[key];
    if (rawValue !== undefined) {
      const value = extractInt(rawValue);
      ret[key] = value;
    }
  }

  if (x.items !== undefined) {
    ret.items = constructValidator(x.items, cache);
  }

  if (x.properties !== undefined) {
    ret.properties = new NodeMap(extractMapEntries(x.properties)
      .map(([key, value]) => [key, constructValidator(value, cache)] as const)
    );
  }

  if (x.additionalProperties !== undefined) {
    ret.additionalProperties = constructValidator(x.additionalProperties, cache);
  }

  if (x.anyOf !== undefined) {
    ret.anyOf = x.anyOf.content.map(v => constructValidator(v, cache));
  }

  return ret;
}
