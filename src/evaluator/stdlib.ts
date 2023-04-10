import {
  type RepresentationNode,
  RepresentationSequence,
  RepresentationMapping,
} from '@/nodes';
import type { AnnotationFunction } from '.';

import { assertMap, isAnnotation, extractAnnotationInfo } from './helpers';
import { single, assertNotNull, Y } from '@/util';

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

  quote(annotation) {
    return annotation.value;
  },

  eval(annotation, context, evaluate) {
    return evaluate(evaluate(annotation.value, context), context);
  },

  quasiquote(annotation, context, evaluate) {
    return Y<RepresentationNode, [RepresentationNode]>((rec, node): RepresentationNode => {
      if (isAnnotation(node)) {
        const a = extractAnnotationInfo(node);
        if (a.name === 'unquote') {
          return evaluate(a.value, context);
        }
      }

      switch (node.kind) {
        case 'scalar': return node;
        case 'sequence': return new RepresentationSequence(node.tag, Array.from(node).map(rec));
        case 'mapping': return new RepresentationMapping(node.tag, Array.from(node).map(([k, v]) => [rec(k), rec(v)]));
      }
    })(annotation.value);
  },

  unquote() {
    throw new Error(`Can't evaluate unquote.`);
  }
};

export default STDLIB;
