import type { Library } from '.';
import {
  bool, extractBool,
} from '@/helpers';
import { simpleAnnotation, specs } from '../signature';

export default {
  not: simpleAnnotation(specs.bool, [], value => bool(!extractBool(value))),
  and: simpleAnnotation(specs.seqOf(specs.bool), [], value => bool(Array.from(value).every(extractBool))),
  or: simpleAnnotation(specs.seqOf(specs.bool), [], value => bool(Array.from(value).some(extractBool))),
} as Library;
