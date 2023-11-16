import {
  str, bool,
  isStr as _isStr, isNull as _isNull, isBool as _isBool, isInt as _isInt, isFloat as _isFloat, isSeq as _isSeq, isMap as _isMap, int,
  extractInt,
} from '@/helpers';

import { NodeComparator } from '@/nodes/equality';
import { assertType, simpleAnnotation, specs } from '../signature';

export const kind = simpleAnnotation({}, [], value => str(value.kind));
export const tag = simpleAnnotation({}, [], value => str(value.tag));
export const size = simpleAnnotation({}, [], value => int(BigInt(value.size)));

export const get = simpleAnnotation({}, [{}], (value, [key]) => {
  if (value.kind === 'sequence') {
    assertType(key, specs.int);
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
});

export const equal = simpleAnnotation({ kind: 'sequence', tag: 'tag:yaml.org,2002:seq' }, [], value => {
  return bool(new NodeComparator().equals(...value));
});

export const isStr = simpleAnnotation({}, [], value => bool(_isStr(value)));
export const isNull = simpleAnnotation({}, [], value => bool(_isNull(value)));
export const isBool = simpleAnnotation({}, [], value => bool(_isBool(value)));
export const isInt = simpleAnnotation({}, [], value => bool(_isInt(value)));
export const isFloat = simpleAnnotation({}, [], value => bool(_isFloat(value)));
export const isSeq = simpleAnnotation({}, [], value => bool(_isSeq(value)));
export const isMap = simpleAnnotation({}, [], value => bool(_isMap(value)));
