import type { Library } from '.';
import { extractBool, extractSeqItems, seq, str } from '@/helpers';
import { assertType, simpleAnnotation, specs } from '../signature';
import type { AnnotationFunction } from '..';

function helper(...[value, args, context, evaluate]: Parameters<AnnotationFunction>) {
  const [rawName, body] = args;
  const nameNode = evaluate(rawName, context);
  assertType(nameNode, specs.str);

  const sequence = evaluate(value, context);
  assertType(sequence, specs.seq);

  return {
    items: Array.from(sequence),
    name: nameNode.content,
    body,
  };
}

export default {
  concatenate: simpleAnnotation(specs.seq, [], value => seq(Array.from(value).flatMap(extractSeqItems))),

  map(value, args, context, evaluate) {
    const { items, name, body } = helper(value, args, context, evaluate);

    return seq(items.map(item => evaluate(body, context.merge([[str(name), item]]))));
  },

  filter(value, args, context, evaluate) {
    const { items, name, body } = helper(value, args, context, evaluate);

    return seq(items.filter(item => {
      const result = evaluate(body, context.merge([[str(name), item]]));
      assertType(result, specs.bool);
      return extractBool(result);
    }));
  },
} as Library;
