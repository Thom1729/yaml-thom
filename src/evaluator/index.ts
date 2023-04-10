import {
  type RepresentationNode,
  RepresentationScalar,
  RepresentationMapping,
  RepresentationSequence,
} from '@/nodes';

import { extractStrContent, extractSeqItems, extractStringMap, isAnnotation } from './helpers';

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
  const { name, value, arguments: args } = extractStringMap(annotation, ['name', 'value', 'arguments']);

  return {
    name: extractStrContent(name),
    value: value,
    arguments: extractSeqItems(args),
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
