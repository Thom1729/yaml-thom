import * as bool from './bool';
import * as conditions from './conditions';
import * as core from './core';
import * as int from './int';
import * as nodes from './nodes';
import * as map from './map';
import * as seq from './seq';
import * as string from './string';

import type { Library } from '..';
import { strictEntries, strictFromEntries } from '@/util';

function stripLeadingUnderscore<T extends string>(s: T) {
  return s.replace(/^_/, '') as T extends `_${infer Rest}` ? Rest : T;
}

const stdlib = strictFromEntries(
  strictEntries({
    ...core,
    ...nodes,
    ...conditions,

    ...string,
    ...bool,
    ...int,
    ...seq,
    ...map,
  }).map(([name, func]) => [stripLeadingUnderscore(name), func])
) satisfies Library;

export default stdlib;
