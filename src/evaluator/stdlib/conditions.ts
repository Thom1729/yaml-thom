import type { Library } from '.';
import { extractBool } from '../helpers';
import { specs, assertType, assertArgumentTypes } from '../signature';

export default {
  if(value, rawArgs, context, evaluate) {
    const args = rawArgs.map(arg => evaluate(arg, context));
    assertArgumentTypes(args, [specs.bool]);
    const [condition] = args;

    assertType(value, specs.seq);
    if (value.size !== 2) throw new TypeError(`Expected two cases`);
    const [ifTrue, ifFalse] = value;

    return extractBool(condition)
      ? evaluate(ifTrue, context)
      : evaluate(ifFalse, context);
  }
} satisfies Library;
