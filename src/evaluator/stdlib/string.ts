import type { Library } from '.';
import { str, extractStrContent } from '@/nodes';
import { simpleAnnotation, specs } from '../signature';

export default {
  uppercase: simpleAnnotation(specs.str, [], value => str(value.content.toUpperCase())),
  lowercase: simpleAnnotation(specs.str, [], value => str(value.content.toLowerCase())),

  join: simpleAnnotation(specs.seqOf(specs.str), [], value => str(Array.from(value).map(extractStrContent).join('')))
} as Library;
