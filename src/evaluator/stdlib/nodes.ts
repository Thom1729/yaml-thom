import { type Library } from './util';
import {
  str, bool,
  isStr, isNull, isBool, isInt, isFloat, isSeq, isMap, int,
  extractInt,
} from '../helpers';

import { equals } from '@/nodes/equality';
import { simpleAnnotation } from '../signature';

export default {
  kind: simpleAnnotation({}, [], value => str(value.kind)),
  tag: simpleAnnotation({}, [], value => str(value.tag)),
  size: simpleAnnotation({}, [], value => int(BigInt(value.size))),

  get: simpleAnnotation({}, [{}], (value, [key]) => {
    if (value.kind === 'sequence') {
      const result = value.get(Number(extractInt(key)));
      if (result === null) throw new TypeError(`index out of bounds`);
      return result;
    } else if (value.kind === 'mapping') {
      const result = value.get(key);
      if (result === null) throw new TypeError(`key not in mapping`);
      return result;
    } else {
      throw new TypeError(`scalar`);
    }
  }),

  equal: simpleAnnotation({ kind: 'sequence', tag: 'tag:yaml.org,2002:seq' }, [], value => {
    if (value.size > 0) {
      const [first, ...rest] = value;
      for (const node of rest) {
        if (!equals(first, node)) return bool(false);
      }
    }
    return bool(true);
  }),

  isStr: simpleAnnotation({}, [], value => bool(isStr(value))),
  isNull: simpleAnnotation({}, [], value => bool(isNull(value))),
  isBool: simpleAnnotation({}, [], value => bool(isBool(value))),
  isInt: simpleAnnotation({}, [], value => bool(isInt(value))),
  isFloat: simpleAnnotation({}, [], value => bool(isFloat(value))),
  isSeq: simpleAnnotation({}, [], value => bool(isSeq(value))),
  isMap: simpleAnnotation({}, [], value => bool(isMap(value))),
} satisfies Library;
