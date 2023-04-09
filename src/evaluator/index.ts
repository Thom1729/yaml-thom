import {
  type RepresentationNode,
  RepresentationScalar,
  RepresentationMapping,
  RepresentationSequence,
} from '@/nodes';

import { isStr, isSeq, isAnnotation } from './helpers';

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

function getAnnotationInfo(annotation: RepresentationMapping): Annotation {
  let name = null, annotated = null, args = null;

  for (const [key, value] of annotation) {
    if (!isStr(key)) throw new TypeError(`Expected str, got ${key.kind}<${key.tag}>`);

    if (key.content === 'name') {
      if (!isStr(value)) throw new TypeError(`Expected str, got ${value.kind}<${value.tag}>`);
      name = value.content;
    } else if (key.content === 'value') {
      annotated = value;
    } else if (key.content === 'arguments') {
      if (!isSeq(value)) throw new TypeError(`Expected args to be seq`);
      args = value.content;
    } else {
      throw new TypeError(`Unexpected key ${key.content}`);
    }
  }

  if (name === null) throw new TypeError('missing name');
  if (annotated === null) throw new TypeError('missing value');

  return {
    name,
    value: annotated,
    arguments: args ?? [],
  };
}

export function evaluate(
  node: RepresentationNode,
  context: RepresentationMapping,
): RepresentationNode {
  if (isAnnotation(node)) {
    const annotation = getAnnotationInfo(node);

    const f = STDLIB[annotation.name];
    if (f === undefined) {
      throw new TypeError(`Unknown annotation ${annotation.name}`);
    }

    return f(annotation, context, evaluate);
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
