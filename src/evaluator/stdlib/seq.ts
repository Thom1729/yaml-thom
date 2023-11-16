import type { Library } from '.';
import { extractBool, extractSeqItems, seq, str } from '@/helpers';
import { assertType, simpleAnnotation, specs } from '../signature';
import type { AnnotationFunction, Evaluator } from '..';

function helper(this: Evaluator, ...[value, args, context]: Parameters<AnnotationFunction>) {
  const [rawName, body] = args;
  const nameNode = this.evaluate(rawName, context);
  assertType(nameNode, specs.str);

  const sequence = this.evaluate(value, context);
  assertType(sequence, specs.seq);

  return {
    items: Array.from(sequence),
    name: nameNode.content,
    body,
  };
}

export default {
  concatenate: simpleAnnotation(specs.seq, [], value => seq(Array.from(value).flatMap(extractSeqItems))),

  map(value, args, context) {
    const { items, name, body } = helper.call(this, value, args, context);

    return seq(items.map(item => this.evaluate(body, context.merge([[str(name), item]]))));
  },

  filter(value, args, context) {
    const { items, name, body } = helper.call(this, value, args, context);

    return seq(items.filter(item => {
      const result = this.evaluate(body, context.merge([[str(name), item]]));
      assertType(result, specs.bool);
      return extractBool(result);
    }));
  },
} as Library;
