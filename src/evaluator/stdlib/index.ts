import core from './core';
import nodes from './nodes';
import string from './string';
import type { Library } from './util';

export default {
  ...core,
  ...nodes,
  ...string,
} as Library;
