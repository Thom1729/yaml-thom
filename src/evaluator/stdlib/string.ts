import { str, extractStrContent } from '@/helpers';
import { simpleAnnotation, specs } from '../signature';

export const uppercase = simpleAnnotation(specs.str, [], value => str(value.content.toUpperCase()));
export const lowercase = simpleAnnotation(specs.str, [], value => str(value.content.toLowerCase()));

export const join = simpleAnnotation(specs.seqOf(specs.str), [], value => str(Array.from(value).map(extractStrContent).join('')));
