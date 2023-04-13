import { assertNoArgs, type Library } from './util';
import { extractSeqItems, seq } from '../helpers';

export default {
  concatenate(value, args) {
    assertNoArgs(args);
    return seq(extractSeqItems(value).flatMap(extractSeqItems));
  }
} satisfies Library;
