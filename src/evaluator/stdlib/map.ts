import type { Library } from '.';
import { seq } from '../helpers';
import { simpleAnnotation, specs } from '../signature';

export default {
  pairs: simpleAnnotation(specs.map, [], value => seq(Array.from(value).map(seq))),
} satisfies Library;
