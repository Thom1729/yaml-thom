import type { Validator } from '.';
import type { RepresentationNode } from '@/nodes';

import { extractStringMap } from '@/nodes';
import { defaultConstructor } from '@/constructor';

export function constructValidator(node: RepresentationNode): Validator {
  const x = extractStringMap(node, ['kind?', 'tag?', 'const?', 'minLength?', 'items?']);

  const ret: Validator = {};

  if (x.kind !== undefined) {
    const kind = defaultConstructor(x.kind);
    if (kind !== 'scalar' && kind !== 'sequence' && kind !== 'mapping') throw new TypeError();
    ret.kind = kind;
  }

  if (x.tag !== undefined) {
    const tag = defaultConstructor(x.tag);
    if (typeof tag !== 'string') throw new TypeError();
    ret.tag = tag;
  }

  if (x.const !== undefined) {
    ret.const = x.const;
  }

  if (x.minLength !== undefined) {
    const minLength = defaultConstructor(x.minLength);
    if (typeof minLength !== 'bigint') throw new TypeError();
    ret.minLength = minLength;
  }

  if (x.items !== undefined) {
    ret.items = constructValidator(x.items);
  }

  return ret;
}
