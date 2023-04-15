import type { Library } from '.';
import { assertMap, extractBool } from '../helpers';
import { specs, assertType, assertArgumentTypes } from '../signature';
import { equals } from '@/nodes/equality';

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
  },

  switch(value, args, context, evaluate) {
    assertArgumentTypes(args, [{}]);
    const ref = evaluate(args[0], context);

    assertType(value, specs.seqOf(specs.map));

    for (const c of value) {
      assertMap(c); // Redundant, but seqOf doesn't type the children yet
      if (c.size !== 1) throw new TypeError(`Each branch should have one key/value`);
      const [[rawComparison, rawBody]] = c;

      const comparison = evaluate(rawComparison, context);
      if (equals(comparison, ref)) return evaluate(rawBody, context);
    }
    throw new Error(`no case matched`); // TODO: default option
  },

  cond(value, args, context, evaluate) {
    assertArgumentTypes(args, []);

    assertType(value, specs.seqOf(specs.map));

    for (const branch of value) {
      assertMap(branch); // Redundant, but seqOf doesn't type the children yet
      if (branch.size !== 1) throw new TypeError(`Each branch should have one key/value`);
      const [[rawTest, rawBody]] = branch;

      const testResult = evaluate(rawTest, context);
      assertType(testResult, specs.bool);
      if (extractBool(testResult)) return evaluate(rawBody, context);
    }
    throw new Error(`no case matched`);
  },
} satisfies Library;
