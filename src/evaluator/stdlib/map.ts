import type { Library } from '.';
import { seq, map } from '@/nodes';
import { simpleAnnotation, specs } from '../signature';

export default {
  pairs: simpleAnnotation(specs.map, [], value => seq(Array.from(value).map(seq))),

  merge: simpleAnnotation(specs.seqOf(specs.map), [], value => {
    if (value.size === 0) {
      return map([]);
    } else {
      const [first, ...rest] = value;
      let result = first;
      for (const other of rest) {
        result = result.merge(other);
      }
      return result;
    }
  })
} as Library;
