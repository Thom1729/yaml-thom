import type { RepresentationNode } from '@/nodes';
import type { AnnotationFunction } from '.';

import { assertMap, isAnnotation, extractAnnotationInfo } from './helpers';
import { assertNotNull, Y } from '@/util';

function assertNoArgs(args: readonly RepresentationNode[]) {
  if (args.length > 0) throw new TypeError('No arguments expected');
}

const STDLIB: Partial<Record<string, AnnotationFunction>> = {
  var(value, args, context, evaluate) {
    assertNoArgs(args);
    const key = evaluate(value, context);
    const result = context.get(key);
    assertNotNull(result, `var ${key} not found`);
    return result;
  },

  let(value, args, context, evaluate) {
    let newContext = context;
    for (const arg of args) {
      assertMap(arg, 'let args should be maps');

      newContext = newContext.merge(arg.map(node => evaluate(node, newContext)));
    }
    return evaluate(value, newContext);
  },

  quote(value, args) {
    assertNoArgs(args);
    return value;
  },

  eval(value, args, context, evaluate) {
    assertNoArgs(args);
    return evaluate(evaluate(value, context), context);
  },

  quasiquote(value, args, context, evaluate) {
    assertNoArgs(args);
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
    })(value);
  },

  unquote() {
    throw new Error(`Can't evaluate unquote.`);
  }
};

export default STDLIB;
