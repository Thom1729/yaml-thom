import type { RepresentationNode } from '@/nodes';

import { assertMap, isAnnotation, extractAnnotationInfo } from '../helpers';
import { Y } from '@/util';

import { assertNoArgs, type Library } from './util';
import { simpleAnnotation } from '../signature';

export default {
  var: simpleAnnotation({ kind: 'scalar' }, [], (value, _, context) => {
    const result = context.get(value);
    if (result === null) throw new TypeError(`var ${value} not found`);
    return result;
  }),

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

  eval: simpleAnnotation({}, [], (value, _, context, evaluate) => evaluate(value, context)),

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
} satisfies Library;
