import type { Validator } from './types';

import { NodeMap, type RepresentationScalar } from '@/nodes';
import { strictEntries } from '@/util';
import * as H from '@/helpers';

export const str = {
  kind: ['scalar'],
  tag: ['tag:yaml.org,2002:str'],
} as const satisfies Validator;

export const bool = {
  kind: ['scalar'],
  tag: ['tag:yaml.org,2002:bool'],
} as const satisfies Validator;

export const seq = {
  kind: ['sequence'],
  tag: ['tag:yaml.org,2002:seq'],
} as const satisfies Validator;

export function seqOf<T extends Validator>(items: T) {
  return {
    ...seq,
    items,
  } satisfies Validator;
}

export const map = {
  kind: ['mapping'],
  tag: ['tag:yaml.org,2002:map'],
} as const satisfies Validator;

export function stringMapOf<T extends Record<string, Validator>>(properties: T) {
  const pairs = strictEntries(properties).map(([key, value]) => [H.str(key as string), value]) as
    {
      [K in keyof T & string]: [
        RepresentationScalar<'tag:yaml.org,2002:str', K>,
        T[K],
      ]
    }[keyof T & string][];

  return {
    ...map,
    properties: new NodeMap(pairs),
  } satisfies Validator;
}
