import { assertNoArgs, type Library } from './util';
import {
  bool, extractBool, extractSeqItems,
} from '../helpers';

export default {
  and(value, args) {
    assertNoArgs(args);
    return bool(extractSeqItems(value).every(extractBool));
  },

  or(value, args) {
    assertNoArgs(args);
    return bool(extractSeqItems(value).some(extractBool));
  },
} satisfies Library;
