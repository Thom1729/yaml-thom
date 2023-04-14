import { type Library } from './util';
import {
  bool, extractBool,
} from '../helpers';
import { simpleAnnotation } from '../signature';

export default {
  and: simpleAnnotation({ kind: 'sequence' }, [], value => bool(Array.from(value).every(extractBool))),
  or: simpleAnnotation({ kind: 'sequence' }, [], value => bool(Array.from(value).some(extractBool))),
} satisfies Library;
