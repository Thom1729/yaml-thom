import {
  type RepresentationNode,
  RepresentationScalar,
  RepresentationMapping,
  RepresentationSequence,
} from '@/nodes';

import { isAnnotation, extractAnnotationInfo } from './helpers';

import STDLIB from './stdlib';

interface Annotation {
  name: string,
  value: RepresentationNode,
  arguments: readonly RepresentationNode[],
}

export type AnnotationFunction = (
  annotation: Annotation,
  context: RepresentationMapping,
  evaluate: (node: RepresentationNode, context: RepresentationMapping) => RepresentationNode,
) => RepresentationNode;

export class EvaluationError extends Error {
  node: RepresentationNode;

  constructor(node: RepresentationNode, msg: string, cause: unknown) {
    super(msg, { cause });
    Object.setPrototypeOf(this, EvaluationError.prototype);
    this.node = node;
  }
}

export function evaluate(
  node: RepresentationNode,
  context: RepresentationMapping,
): RepresentationNode {
  if (isAnnotation(node)) {
    try {
      const annotation = extractAnnotationInfo(node);

      const f = STDLIB[annotation.name];
      if (f === undefined) {
        throw new TypeError(`Unknown annotation ${annotation.name}`);
      }

      return f(annotation, context, evaluate);
    } catch (e) {
      if (e instanceof EvaluationError) {
        throw e;
      } else {
        throw new EvaluationError(node, '', e);
      }
    }
  }

  // TODO: keep track of evaluated nodes
  switch (node.kind) {
    case 'scalar': return new RepresentationScalar(
      node.tag,
      node.content,
    );
    case 'sequence': return new RepresentationSequence(
      node.tag,
      node.content.map(
        child => evaluate(child, context)
      )
    );
    case 'mapping': return new RepresentationMapping(
      node.tag,
      node.content.map(
        ([key, value]) => [evaluate(key, context), evaluate(value, context)]
      )
    );
  }
}
