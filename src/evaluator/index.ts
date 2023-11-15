import {
  RepresentationNode,
  RepresentationMapping,
  RepresentationSequence,
  NodeComparator,
  NodeMap,
} from '@/nodes';

import {
  isAnnotation, extractAnnotationInfo,
} from '@/helpers';

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
) {
  return new Evaluator().evaluate(node, context);
}

import { NestedMap } from '@/util/nestedMap';

class Evaluator {
  readonly cache = new NestedMap<[RepresentationNode, RepresentationMapping], RepresentationNode | null>(
    () => new WeakMap(),
    () => new NodeMap(),
  );
  readonly comparator = new NodeComparator();

  evaluate(
    node: RepresentationNode,
    context: RepresentationMapping,
  ): RepresentationNode {
    const cached = this.cache.get(node, context);
    if (cached === null) {
      throw new Error(`Recursively evaluating same annotation node with different context`);
    } else if (cached !== undefined) {
      return cached;
    }

    if (isAnnotation(node)) {
      let annotation: Annotation;
      try {
        annotation = extractAnnotationInfo(node);
      } catch (e) {
        throw new EvaluationError(node, null, 'Invalid annotation node', e);
      }

      const annotationFunction = STDLIB[annotation.name];
      if (annotationFunction === undefined) {
        throw new EvaluationError(node, annotation, `Unknown annotation ${annotation.name}`);
      }

      try {
        this.cache.set(node, context, null);
        const result = annotationFunction(annotation.value, annotation.arguments, context, this.evaluate.bind(this));
        this.cache.set(node, context, result);
        return result;
      } catch (e) {
        if (e instanceof EvaluationError) {
          throw e;
        } else {
          throw new EvaluationError(node, annotation, `Error evaluating annotation ${annotation.name}`, e);
        }
      }
    }

    switch (node.kind) {
      case 'scalar': {
        const result = node.clone();
        this.cache.set(node, context, result);
        return result;
      }
      case 'sequence': {
        const result = new RepresentationSequence<string, RepresentationNode>(node.tag, []);
        this.cache.set(node, context, result);
        for (const item of node) {
          result.content.push(this.evaluate(item, context));
        }
        return result;
      }
      case 'mapping': {
        const result = new RepresentationMapping<string, readonly [RepresentationNode, RepresentationNode]>(node.tag, []);
        this.cache.set(node, context, result);
        for (const [key, value] of node) {
          result.content.pairs.push([
            this.evaluate(key, context),
            this.evaluate(value, context),
          ]);
        }
        result.content.pairs.sort((a, b) => this.comparator.compare(a[0], b[0]));
        return result;
      }
    }
  }
}
