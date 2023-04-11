import core from './core';
import nodes from './nodes';
import string from './string';
import bool from './bool';
import type { Library } from './util';

export default {
  ...core,
  ...nodes,
  ...string,
  ...bool,
} as Library;
