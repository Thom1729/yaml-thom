import type { AnnotationFunction } from '..';
import { validateAnnotation, constructAnnotation } from '../annotation';

import { RepresentationNode, RepresentationSequence, RepresentationMapping, RepresentationScalar } from '@/nodes';
import { assertMap, isAnnotation } from '@/helpers';
import { assertNotUndefined } from '@/util';
import { transformNode, makeResult } from '@/nodes';

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
    newContext = newContext.merge(
      Array.from(arg).map(([key, value]) => [
        this.evaluate(key, newContext),
        this.evaluate(value, newContext),
      ])
    );
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

  return transformNode<RepresentationNode>(value, node => {
    if (isAnnotation(node)) {
      validateAnnotation(node);
      const childAnnotation = constructAnnotation(node);
      if (childAnnotation.name === 'unquote') {
        return this.evaluate(childAnnotation.value, context);
      }
    }

    switch (node.kind) {
      case 'scalar': return new RepresentationScalar(node.tag, node.content);
      case 'sequence': return makeResult(
        new RepresentationSequence(node.tag),
        (seq, recurse) => {
          for (const item of node) {
            seq.content.push(recurse(item));
          }
        }
      );
      case 'mapping': return makeResult(
        new RepresentationMapping(node.tag),
        (map, recurse) => {
          for (const [key, value] of node) {
            map.content.pairs.push([
              recurse(key),
              recurse(value),
            ]);
          }
          map.content.pairs.sort((a, b) => this.comparator.compare(a[0], b[0]));
        }
      );
    }
  });
};
