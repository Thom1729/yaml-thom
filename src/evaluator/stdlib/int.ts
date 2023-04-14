import { type Library } from './util';
import { int, extractInt } from '../helpers';

import { simpleAnnotation, specs } from '../signature';

export default {
  sum: simpleAnnotation(specs.seqOf(specs.int), [], value => int(Array.from(value).map(extractInt).reduce((a,b) => a+b, 0n))),
  min: simpleAnnotation(specs.seqOf(specs.int), [], value => int(Array.from(value).map(extractInt).reduce((a,b) => a>b ? b : a))),
  max: simpleAnnotation(specs.seqOf(specs.int), [], value => int(Array.from(value).map(extractInt).reduce((a,b) => a<b ? b : a))),
} satisfies Library;
