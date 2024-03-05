import {
  NodeMap, NodeComparator,
  type RepresentationNode,
  RepresentationScalar, RepresentationMapping, RepresentationSequence,
  isRepresentationNode,
} from '@/nodes';

import { NestedMap } from '@/util';
import { validateAnnotation, constructAnnotation } from './annotation';
import { isAnnotation } from '@/helpers';

import type { Annotation, EvaluationOptions, AnnotationFunctionResult, EvaluateFunction } from '..';

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

export class Evaluator {
  readonly cache = new NestedMap<[RepresentationNode, RepresentationMapping], RepresentationNode | null>(
    () => new WeakMap(),
    () => new NodeMap(),
  );
  readonly comparator = new NodeComparator();
  readonly options: EvaluationOptions;

  constructor(options: EvaluationOptions) {
    this.options = options;
  }

  deferred<T extends RepresentationNode>(
    value: T,
    deferred: (value: T, evaluate: EvaluateFunction) => void,
  ): AnnotationFunctionResult {
    return {
      value,
      deferred: evaluate => { deferred(value, evaluate); },
    };
  }

  scalar(tag: string, content: string): AnnotationFunctionResult {
    return new RepresentationScalar(tag, content);
  }

  sequence(tag: string, content: (evaluate: EvaluateFunction) => Iterable<RepresentationNode>): AnnotationFunctionResult {
    return this.deferred(
      new RepresentationSequence(tag),
      (node, evaluate) => {
        for (const item of content(evaluate)) {
          node.content.push(item);
        }
      }
    );
  }

  mapping(tag: string, content: (evaluate: EvaluateFunction) => Iterable<readonly [RepresentationNode, RepresentationNode]>): AnnotationFunctionResult {
    return this.deferred(
      new RepresentationMapping(tag),
      (node, evaluate) => {
        for (const pair of content(evaluate)) {
          node.content.pairs.push(pair);
        }
        node.content.pairs.sort((a, b) => this.comparator.compare(a[0], b[0]));
      }
    );
  }

  default(
    node: RepresentationNode,
    context: RepresentationMapping,
  ): AnnotationFunctionResult {
    switch (node.kind) {
      case 'scalar': return this.scalar(node.tag, node.content);
      case 'sequence': return this.sequence(node.tag, evaluate => Array.from(node).map(child => evaluate(child, context)));
      case 'mapping': return this.mapping(node.tag, evaluate => Array.from(node).map(([key, value]) => [
        evaluate(key, context),
        evaluate(value, context),
      ]));
    }
  }

  evaluate = (
    node: RepresentationNode,
    context: RepresentationMapping,
  ): RepresentationNode => {
    const cached = this.cache.get(node, context);
    if (cached === null) {
      throw new Error(`Recursively evaluating same annotation node with different context`);
    } else if (cached !== undefined) {
      return cached;
    }
    this.cache.set(node, context, null);

    if (isAnnotation(node)) {
      try {
        validateAnnotation(node);
      } catch (e) {
        throw new EvaluationError(node, null, 'Invalid annotation node', e);
      }
      const annotation = constructAnnotation(node);

      const annotationFunction = this.options.annotationFunctions[annotation.name];
      if (annotationFunction === undefined) {
        throw new EvaluationError(node, annotation, `Unknown annotation ${annotation.name}`);
      }

      try {
        const result = annotationFunction.call(this, annotation.value, annotation.arguments, context);

        return this.handleResult(node, context, result);
      } catch (e) {
        if (e instanceof EvaluationError) {
          throw e;
        } else {
          throw new EvaluationError(node, annotation, `Error evaluating annotation ${annotation.name}`, e);
        }
      }
    } else {
      return this.handleResult(node, context, this.default(node, context));
    }
  };

  handleResult(
    originalNode: RepresentationNode,
    context: RepresentationMapping,
    result: AnnotationFunctionResult,
  ): RepresentationNode {
    if (isRepresentationNode(result)) {
      this.cache.set(originalNode, context, result);
      return result;
    } else {
      const node = result.value;
      this.cache.set(originalNode, context, node);
      if (result.deferred !== undefined) {
        result.deferred(this.evaluate);
      }
      return node;
    }
  }
}
