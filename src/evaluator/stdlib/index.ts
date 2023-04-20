import core from './core';
import nodes from './nodes';
import conditions from './conditions';

import string from './string';
import bool from './bool';
import int from './int';
import seq from './seq';
import map from './map';

import type { AnnotationFunction } from '..';

export type Library = Partial<Record<string, AnnotationFunction>>;

export default {
  ...core,
  ...nodes,
  ...conditions,

  ...string,
  ...bool,
  ...int,
  ...seq,
  ...map,
} as Library;
