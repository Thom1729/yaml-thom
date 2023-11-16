import type { Library } from '.';
import { NodeComparator } from '@/nodes';
import { assertMap, extractBool } from '@/helpers';
import { specs, assertType, assertArgumentTypes } from '../signature';

export default {
  if(value, rawArgs, context) {
    const args = rawArgs.map(arg => this.evaluate(arg, context));
    assertArgumentTypes(args, [specs.bool]);
    const [condition] = args;

    assertType(value, specs.seq);
    if (value.size !== 2) throw new TypeError(`Expected two cases`);
    const [ifTrue, ifFalse] = value;

    return extractBool(condition)
      ? this.evaluate(ifTrue, context)
      : this.evaluate(ifFalse, context);
  },

  switch(value, args, context) {
    assertArgumentTypes(args, [{}]);
    const ref = this.evaluate(args[0], context);

    assertType(value, specs.seqOf(specs.map));

    for (const c of value) {
      assertMap(c); // Redundant, but seqOf doesn't type the children yet
      if (c.size !== 1) throw new TypeError(`Each branch should have one key/value`);
      const [[rawComparison, rawBody]] = c;

      const comparison = this.evaluate(rawComparison, context);
      if (new NodeComparator().equals(comparison, ref)) return this.evaluate(rawBody, context);
    }
    throw new Error(`no case matched`); // TODO: default option
  },

  cond(value, args, context) {
    assertArgumentTypes(args, []);

    assertType(value, specs.seqOf(specs.map));

    for (const branch of value) {
      assertMap(branch); // Redundant, but seqOf doesn't type the children yet
      if (branch.size !== 1) throw new TypeError(`Each branch should have one key/value`);
      const [[rawTest, rawBody]] = branch;

      const testResult = this.evaluate(rawTest, context);
      assertType(testResult, specs.bool);
      if (extractBool(testResult)) return this.evaluate(rawBody, context);
    }
    throw new Error(`no case matched`);
  },
} as Library;
