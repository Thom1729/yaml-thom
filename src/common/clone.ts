import {
  Alias,
  Scalar,
  SerializationMapping,
  Sequence,
  type SerializationNode
} from './nodes';

export function cloneSerializationTree(
  tree: SerializationNode,
) {
  function clone(node: SerializationNode): SerializationNode {
    let ret: SerializationNode;
    if (node.kind === 'alias') {
      ret = new Alias(node.alias);
    } else if (node.kind === 'scalar') {
      ret = new Scalar(node.tag, node.content);
      if (node.anchor !== undefined) ret.anchor = node.anchor;
    } else if (node.kind === 'sequence') {
      ret = new Sequence(node.tag, []);
      if (node.anchor !== undefined) ret.anchor = node.anchor;
      for (const child of node) {
        ret.content.push(clone(child));
      }
    } else if (node.kind === 'mapping') {
      ret = new SerializationMapping(node.tag, []);
      if (node.anchor !== undefined) ret.anchor = node.anchor;
      for (const [key, value] of node.content) {
        ret.content.push([clone(key), clone(value)]);
      }
    } else {
      throw new Error('unreachable');
    }
    return ret;
  }

  return clone(tree);
}
