import * as bool from './bool';
import * as conditions from './conditions';
import * as core from './core';
import * as int from './int';
import * as nodes from './nodes';
import * as map from './map';
import * as seq from './seq';
import * as string from './string';

import type { AnnotationFunction } from '..';
import { strictEntries, strictFromEntries } from '@/util';

export type Library = Partial<Record<string, AnnotationFunction>>;

export default strictFromEntries(
  strictEntries({
    ...core,
    ...nodes,
    ...conditions,

    ...string,
    ...bool,
    ...int,
    ...seq,
    ...map,
  }).map(([name, func]) => [name.replace(/^_/, ''), func])
) as Library;
