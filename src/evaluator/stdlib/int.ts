import { assertNoArgs, type Library } from './util';
import { int, extractInt, extractSeqItems } from '../helpers';

export default {
  sum(value, args) {
    assertNoArgs(args);
    return int(extractSeqItems(value).map(extractInt).reduce((a,b) => a+b, 0n));
  },

  min(value, args) {
    assertNoArgs(args);
    const items = extractSeqItems(value).map(extractInt);
    if (items.length === 0) throw new TypeError(`no items`);
    return int(items.reduce((a,b) => a>b ? b : a));
  },

  max(value, args) {
    assertNoArgs(args);
    const items = extractSeqItems(value).map(extractInt);
    if (items.length === 0) throw new TypeError(`no items`);
    return int(items.reduce((a,b) => a>b ? a : b));
  },
} satisfies Library;
