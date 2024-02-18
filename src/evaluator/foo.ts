import {
  // validate,
  assertValid,
  type Validator, type Validated,
} from '@/validator';

import type { Evaluator, AnnotationFunction } from '.';

import type {
  RepresentationNode,
  RepresentationMapping,
} from '@/nodes';

import { zip } from '@/util';

// interface Annotation<
//   TValue extends RepresentationNode,
//   TArgs extends readonly Validator[],
// > {
//   // name: string,
//   value: TValue,
//   args: TArgs,
// }

export interface AnnotationSpec<
  TValue extends Validator,
  TArgs extends readonly Validator[],
> {
  value?: TValue;
  rawValue?: boolean,

  args?: TArgs;
  rawArgs?: boolean;

  implementation: (
    this: Evaluator,
    // annotation: Annotation<Validated<TValue>, ValidatedArgs<TArgs>>,
    annotation: {
      value: Validated<TValue>,
      args: ValidatedArgs<TArgs>,
    },
    context: RepresentationMapping,
  ) => RepresentationNode,
}

type ValidatedArgs<TArgs extends readonly Validator[]> =
  TArgs extends readonly [infer First extends Validator, ...infer Rest extends Validator[]]
    ? [Validated<First>, ...ValidatedArgs<Rest>]
    : [];

// type t = ValidatedArgs<[{}]>

export function annotationFromSpec<
  const TValue extends Validator,
  const TArgs extends readonly Validator[],
>(
  annotationSpec: AnnotationSpec<TValue, TArgs>,
): AnnotationFunction {
  return function (rawValue, rawArgs, context) {
    const value = annotationSpec.rawValue ? rawValue : this.evaluate(rawValue, context);
    if (annotationSpec.value !== undefined) {
      assertValid(annotationSpec.value, value);
    }

    const expectedArgCount = annotationSpec.args?.length ?? 0;
    if (expectedArgCount !== rawArgs.length) {
      throw new TypeError(`Expected ${expectedArgCount} arguments but got ${rawArgs.length}`);
    }
    const args = annotationSpec.rawArgs ? rawArgs : rawArgs.map(arg => this.evaluate(arg, context));

    if (expectedArgCount > 0) {
      for (const [argValidator, rawArg] of zip(annotationSpec.args as readonly Validator[], args)) {
        const arg = annotationSpec.rawArgs ? rawArg : this.evaluate(rawArg, context);
        assertValid(argValidator, arg);
      }
    }

    const a = {
      value: value as Validated<TValue>,
      args: args as ValidatedArgs<TArgs>,
    };
    return annotationSpec.implementation.call(this, a, context);
  };
}
