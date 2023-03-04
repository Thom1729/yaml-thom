import {
  type RepresentationNode,
  RepresentationScalar,
  RepresentationMapping,
  RepresentationSequence,
} from "@/nodes";

import { isStr, isSeq, isMap, isAnnotation } from './helpers';

function getAnnotationInfo(annotation: RepresentationMapping) {
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
    const { name, value, arguments: args } = getAnnotationInfo(node);

    const f = ANNOTATION_FUNCTIONS[name];
    if (f === undefined) {
      throw new TypeError(`Unknown annotation ${name}`);
    }

    return f(value, args, context);
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
    )
  }
}

type AnnotationFunction = (
  node: RepresentationNode,
  args: RepresentationNode[],
  context: RepresentationMapping,
) => RepresentationNode;

const ANNOTATION_FUNCTIONS: Partial<Record<string, AnnotationFunction>> = {
  var(node, args, context) {
    const result = context.get(evaluate(node, context));
    if (result === null) throw new TypeError(`No var ${node.content}`);
    return result;
  },

  let(node, args, context) {
    let c = context;
    for (const arg of args) {
      if (!isMap(arg)) throw new TypeError('let args should be maps');
      if (arg.size !== 1) throw new TypeError(`let arg had ${arg.size} keys`);

      const [[keyNode, valueNode]] = arg;

      c = c.merge([[evaluate(keyNode, c), evaluate(valueNode, c)]]);
    }
    return evaluate(node, c);
  },
};
