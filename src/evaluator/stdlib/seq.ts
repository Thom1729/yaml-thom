import { assertNoArgs, type Library } from './util';
import { extractInt, assertSeq, extractSeqItems, seq } from '../helpers';
import { single } from '@/util';

export default {
  get(value, args) {
    assertSeq(value);
    const index = Number(extractInt(single(args)));
    if (index >= value.size) throw new TypeError(`index out of bounds`);
    return value.get(index);
  },

  concatenate(value, args) {
    assertNoArgs(args);
    return seq(extractSeqItems(value).flatMap(extractSeqItems));
  }
} satisfies Library;
