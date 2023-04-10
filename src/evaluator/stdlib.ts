import type { AnnotationFunction } from '.';

import { assertMap } from './helpers';
import { single, assertNotNull } from '@/util';

const STDLIB: Partial<Record<string, AnnotationFunction>> = {
  var(annotation, context, evaluate) {
    const key = evaluate(annotation.value, context);
    const result = context.get(key);
    assertNotNull(result, `var ${key} not found`);
    return result;
  },

  let(annotation, context, evaluate) {
    let newContext = context;
    for (const arg of annotation.arguments) {
      assertMap(arg, 'let args should be maps');

      const [keyNode, valueNode] = single(arg, `let arg had ${arg.size} keys`);

      newContext = newContext.merge([[evaluate(keyNode, newContext), evaluate(valueNode, newContext)]]);
    }
    return evaluate(annotation.value, newContext);
  },
};

export default STDLIB;
