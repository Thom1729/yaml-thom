import { assertStr } from '../helpers';
import { assertNoArgs, type Library } from './util';
import { str, extractStrContent, extractSeqItems } from '../helpers';

export default {
  uppercase(value, args) {
    assertNoArgs(args);
    assertStr(value);
    return str(extractStrContent(value).toUpperCase());
  },

  lowercase(value, args) {
    assertNoArgs(args);
    assertStr(value);
    return str(extractStrContent(value).toLowerCase());
  },

  join(value, args) {
    assertNoArgs(args); // TODO support optional delimiter
    return str(extractSeqItems(value).map(extractStrContent).join(''));
  },
} satisfies Library;
