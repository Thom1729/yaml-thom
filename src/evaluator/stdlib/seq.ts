import type { Library } from '.';
import { extractSeqItems, seq } from '../helpers';
import { simpleAnnotation, specs } from '../signature';

export default {
  concatenate: simpleAnnotation(specs.seq, [], value => seq(Array.from(value).flatMap(extractSeqItems))),
} satisfies Library;
