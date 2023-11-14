import {
  RepresentationNode,
  RepresentationMapping,
  RepresentationSequence,
  NodeComparator,
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
  const cache = new Map<RepresentationNode, Map<RepresentationMapping, RepresentationNode | null>>();
  const comparator = new NodeComparator();

  function getCached(
    node: RepresentationNode,
    context: RepresentationMapping,
  ) {
    return cache.get(node)?.get(context);
  }

  function setCached(
    node: RepresentationNode,
    context: RepresentationMapping,
    value: RepresentationNode | null,
  ) {
    let child = cache.get(node);
    if (child === undefined) {
      child = new Map();
      cache.set(node, child);
    }

    child.set(context, value);
  }

  function rec(
    node: RepresentationNode,
    context: RepresentationMapping,
  ): RepresentationNode {
    const cached = getCached(node, context);
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

      const f = STDLIB[annotation.name];
      if (f === undefined) {
        throw new EvaluationError(node, annotation, `Unknown annotation ${annotation.name}`);
      }

      try {
        setCached(node, context, null);
        const result = f(annotation.value, annotation.arguments, context, rec);
        setCached(node, context, result);
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
        setCached(node, context, result);
        return result;
      }
      case 'sequence': {
        const result = new RepresentationSequence(node.tag, [] as RepresentationNode[]);
        setCached(node, context, result);
        for (const item of node) {
          result.content.push(rec(item, context));
        }
        return result;
      }
      case 'mapping': {
        const result = new RepresentationMapping(node.tag, [] as (readonly [RepresentationNode, RepresentationNode])[]);
        setCached(node, context, result);
        for (const [key, value] of node) {
          result.content.pairs.push([
            rec(key, context),
            rec(value, context),
          ]);
        }
        result.content.pairs.sort((a, b) => comparator.compare(a[0], b[0]));
        return result;
      }
    }
  }

  return rec(node, context);
}
