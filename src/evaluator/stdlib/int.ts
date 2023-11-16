import { int, extractInt } from '@/helpers';

import { simpleAnnotation, specs } from '../signature';

export const sum = simpleAnnotation(specs.seqOf(specs.int), [], value => int(Array.from(value).map(extractInt).reduce((a,b) => a+b, 0n)));
export const min = simpleAnnotation(specs.seqOf(specs.int), [], value => int(Array.from(value).map(extractInt).reduce((a,b) => a>b ? b : a)));
export const max = simpleAnnotation(specs.seqOf(specs.int), [], value => int(Array.from(value).map(extractInt).reduce((a,b) => a<b ? b : a)));
