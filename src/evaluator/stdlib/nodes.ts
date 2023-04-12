import { assertNoArgs, type Library } from './util';
import {
  str, bool,
  isStr, isNull, isBool, isInt, isFloat, isSeq, isMap, int,
} from '../helpers';

export default {
  kind(value, args) {
    assertNoArgs(args);
    return str(value.kind);
  },

  tag(value, args) {
    assertNoArgs(args);
    return str(value.tag);
  },

  size(value, args) {
    assertNoArgs(args);
    return int(BigInt(value.size));
  },

  isStr(value, args) {
    assertNoArgs(args);
    return bool(isStr(value));
  },

  isNull(value, args) {
    assertNoArgs(args);
    return bool(isNull(value));
  },

  isBool(value, args) {
    assertNoArgs(args);
    return bool(isBool(value));
  },

  isInt(value, args) {
    assertNoArgs(args);
    return bool(isInt(value));
  },

  isFloat(value, args) {
    assertNoArgs(args);
    return bool(isFloat(value));
  },

  isSeq(value, args) {
    assertNoArgs(args);
    return bool(isSeq(value));
  },

  isMap(value, args) {
    assertNoArgs(args);
    return bool(isMap(value));
  },
} satisfies Library;
