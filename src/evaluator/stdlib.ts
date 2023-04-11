import type { RepresentationNode } from '@/nodes';
import type { AnnotationFunction } from '.';

import { assertMap, isAnnotation, extractAnnotationInfo } from './helpers';
import { assertNotNull, Y } from '@/util';

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

      newContext = newContext.merge(arg.map(node => evaluate(node, newContext)));
    }
    return evaluate(annotation.value, newContext);
  },

  quote(annotation) {
    return annotation.value;
  },

  eval(annotation, context, evaluate) {
    return evaluate(evaluate(annotation.value, context), context);
  },

  quasiquote(annotation, context, evaluate) {
    // TODO handle cycles
    return Y<RepresentationNode, [RepresentationNode]>((rec, node): RepresentationNode => {
      if (isAnnotation(node)) {
        const childAnnotation = extractAnnotationInfo(node);
        if (childAnnotation.name === 'unquote') {
          return evaluate(childAnnotation.value, context);
        }
      }

      switch (node.kind) {
        case 'scalar': return node.clone();
        case 'sequence': return node.map(rec);
        case 'mapping': return node.map(rec);
      }
    })(annotation.value);
  },

  unquote() {
    throw new Error(`Can't evaluate unquote.`);
  }
};

export default STDLIB;
