import {
  bool, extractBool,
} from '@/helpers';
import { simpleAnnotation, specs } from '../signature';

export const not = simpleAnnotation(specs.bool, [], value => bool(!extractBool(value)));
export const and = simpleAnnotation(specs.seqOf(specs.bool), [], value => bool(Array.from(value).every(extractBool)));
export const or = simpleAnnotation(specs.seqOf(specs.bool), [], value => bool(Array.from(value).some(extractBool)));
