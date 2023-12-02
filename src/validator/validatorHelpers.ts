import type { Validator } from './types';

import { NodeMap, NodeSet, type RepresentationScalar } from '@/nodes';
import { strictEntries, strictKeys } from '@/util';
import * as H from '@/helpers';

export const str = {
  kind: new Set(['scalar']),
  tag: ['tag:yaml.org,2002:str'],
} as const satisfies Validator;

export const bool = {
  kind: new Set(['scalar']),
  tag: ['tag:yaml.org,2002:bool'],
} as const satisfies Validator;

export const int = {
  kind: new Set(['scalar']),
  tag: ['tag:yaml.org,2002:int'],
} as const satisfies Validator;

export const seq = {
  kind: new Set(['sequence']),
  tag: ['tag:yaml.org,2002:seq'],
} as const satisfies Validator;

export const map = {
  kind: new Set(['mapping']),
  tag: ['tag:yaml.org,2002:map'],
} as const satisfies Validator;

export function seqOf<T extends Validator>(items: T) {
  return {
    ...seq,
    items,
  } satisfies Validator;
}

export function stringMapOf<T extends Record<string, Validator>>(properties: T) {
  type TKey = keyof T & string;

  const pairs = strictEntries(properties)
    .map(([key, value]) => [H.str((key as TKey).replace(/\?$/, '')), value]) as {
      [K in TKey]: [
        RepresentationScalar<'tag:yaml.org,2002:str', K extends `${infer L}?` ? L : K>,
        T[K],
      ]
    }[TKey][];

  const requiredProperties = strictKeys(properties)
    .filter(key => !(key as TKey).endsWith('?'))
    .map(key => H.str(key as TKey)) as
    RepresentationScalar<'tag:yaml.org,2002:str', TKey extends `${string}?` ? never : TKey>[];

  return {
    ...map,
    properties: new NodeMap(pairs),
    requiredProperties: new NodeSet(requiredProperties),
  } satisfies Validator;
}
