import { assertNoArgs, type Library } from './util';
import {
  str, bool,
  isStr, isNull, isBool, isInt, isFloat, isSeq, isMap, int,
  extractInt,
  extractSeqItems
} from '../helpers';
import { single } from '@/util';
import { equals } from '@/nodes/equality';

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

  get(value, args, context, evaluate) {
    const key = evaluate(single(args), context);
    const v = evaluate(value, context);
    if (v.kind === 'sequence') {
      const index = Number(extractInt(key));
      if (index >= v.size) throw new TypeError(`index out of bounds`);
      return v.get(index);
    } else if (v.kind === 'mapping') {
      const result = v.get(key);
      if (result === null) throw new TypeError(`key not found`);
      return result;
    } else {
      throw new TypeError(`can't call get on scalar`);
    }
  },

  equal(child, args, context, evaluate) {
    assertNoArgs(args);
    const nodes = extractSeqItems(evaluate(child, context));
    if (nodes.length === 0) {
      return bool(true);
    } else {
      const [first, ...rest] = nodes;
      for (const node of rest) {
        if (!equals(first, node)) return bool(false);
      }
      return bool(true);
    }
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
