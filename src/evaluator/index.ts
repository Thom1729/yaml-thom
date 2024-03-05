import type {
  RepresentationNode,
  RepresentationScalar,
  RepresentationSequence,
  RepresentationMapping,
} from '@/nodes';

import { Evaluator } from './evaluate';
export { EvaluationError, Evaluator } from './evaluate';

import STDLIB from './stdlib';

export type EvaluateFunction = (
  node: RepresentationNode,
  context: RepresentationMapping,
) => RepresentationNode;

export type AnnotationFunctionResult =
| RepresentationNode
| { kind: 'scalar', tag: string, content: string }
| { kind: 'sequence', tag: string, content: (evaluate: EvaluateFunction) => Iterable<RepresentationNode> }
| { kind: 'mapping', tag: string, content: (evaluate: EvaluateFunction) => Iterable<readonly [RepresentationNode, RepresentationNode]> };

export interface Annotation {
  name: string,
  value: RepresentationNode,
  arguments: readonly RepresentationNode[],
}

export type AnnotationFunction = (
  this: Evaluator,
  value: RepresentationNode,
  args: readonly RepresentationNode[],
  context: RepresentationMapping,
) => AnnotationFunctionResult;

export type Library = Partial<Record<string, AnnotationFunction>>;

export interface EvaluationOptions {
  annotationFunctions: Library;
}

const DEFAULT_OPTIONS: EvaluationOptions = {
  annotationFunctions: STDLIB,
};

export function evaluate(
  node: RepresentationNode,
  context: RepresentationMapping,
  options: Partial<EvaluationOptions> = {},
) {
  return new Evaluator({
    ...options,
    ...DEFAULT_OPTIONS,
  }).evaluate(node, context);
}
