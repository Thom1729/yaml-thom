import type { AnnotationFunction } from '..';

import type { RepresentationNode } from '@/nodes';
import { assertMap, isAnnotation, extractAnnotationInfo} from '@/helpers';
import { Y, assertNotUndefined } from '@/util';

import { simpleAnnotation, assertArgumentTypes } from '../signature';

export const _var: AnnotationFunction = simpleAnnotation({ kind: 'scalar' }, [], (value, _, context) => {
  const result = context.get(value);
  assertNotUndefined(result, `var ${value} not found`);
  return result;
});

export const _let: AnnotationFunction = function (value, args, context) {
  let newContext = context;
  for (const arg of args) {
    assertMap(arg, 'let args should be maps');
    newContext = newContext.merge(arg.map(node => this.evaluate(node, newContext)));
  }
  return this.evaluate(value, newContext);
};

export const quote: AnnotationFunction = function quote(value, args) {
  assertArgumentTypes(args, []);
  return value;
};

export const _eval: AnnotationFunction = simpleAnnotation({}, [], function (value, _, context) { return this.evaluate(value, context); });

export const quasiquote: AnnotationFunction = function (value, args, context) {
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
};
