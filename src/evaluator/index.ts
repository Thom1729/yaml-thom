import type {
  RepresentationNode,
  RepresentationMapping,
} from '@/nodes';

import { isAnnotation, extractAnnotationInfo } from './helpers';

import STDLIB from './stdlib';

interface Annotation {
  name: string,
  value: RepresentationNode,
  arguments: readonly RepresentationNode[],
}

export type AnnotationFunction = (
  value: RepresentationNode,
  args: readonly RepresentationNode[],
  context: RepresentationMapping,
  evaluate: (node: RepresentationNode, context: RepresentationMapping) => RepresentationNode,
) => RepresentationNode;

export class EvaluationError extends Error {
  node: RepresentationNode;
  annotation: Annotation | null;

  constructor(node: RepresentationNode, annotation: Annotation | null, msg: string, cause?: unknown) {
    super(msg, { cause });
    Object.setPrototypeOf(this, EvaluationError.prototype);
    this.node = node;
    this.annotation = annotation;
  }
}

export function evaluate(
  node: RepresentationNode,
  context: RepresentationMapping,
): RepresentationNode {
  if (isAnnotation(node)) {
    let annotation = null;
    try {
      annotation = extractAnnotationInfo(node);
    } catch (e) {
      throw new EvaluationError(node, null, 'Invalid annotation node', e);
    }

    const f = STDLIB[annotation.name];
    if (f === undefined) {
      throw new EvaluationError(node, annotation, `Unknown annotation ${annotation.name}`);
    }

    try {
      return f(annotation.value, annotation.arguments, context, evaluate);
    } catch (e) {
      if (e instanceof EvaluationError) {
        throw e;
      } else {
        throw new EvaluationError(node, annotation, `Error evaluating annotation ${annotation.name}`, e);
      }
    }
  }

  // TODO: keep track of evaluated nodes
  switch (node.kind) {
    case 'scalar': return node.clone();
    case 'sequence': return node.map(child => evaluate(child, context));
    case 'mapping': return node.map(child => evaluate(child, context));
  }
}
