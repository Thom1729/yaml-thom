import type { Library } from '.';

import type { RepresentationNode } from '@/nodes';
import { assertMap, isAnnotation, extractAnnotationInfo} from '@/helpers';
import { Y } from '@/util';

import { simpleAnnotation, assertArgumentTypes } from '../signature';

export default {
  var: simpleAnnotation({ kind: 'scalar' }, [], (value, _, context) => {
    const result = context.get(value);
    if (result === null) throw new TypeError(`var ${value} not found`);
    return result;
  }),

  let(value, args, context) {
    let newContext = context;
    for (const arg of args) {
      assertMap(arg, 'let args should be maps');
      newContext = newContext.merge(arg.map(node => this.evaluate(node, newContext)));
    }
    return this.evaluate(value, newContext);
  },

  quote(value, args) {
    assertArgumentTypes(args, []);
    return value;
  },

  eval: simpleAnnotation({}, [], function (value, _, context) { return this.evaluate(value, context); }),

  quasiquote(value, args, context) {
    assertArgumentTypes(args, []);
    // TODO handle cycles
    return Y<RepresentationNode, [RepresentationNode]>((rec, node): RepresentationNode => {
      if (isAnnotation(node)) {
        const childAnnotation = extractAnnotationInfo(node);
        if (childAnnotation.name === 'unquote') {
          return this.evaluate(childAnnotation.value, context);
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
} as Library;
