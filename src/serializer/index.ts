import {
  Alias,
  SerializationScalar,
  SerializationSequence,
  SerializationMapping,
  type SerializationNode,
  type SerializationValueNode,
  type RepresentationNode,
} from '@/nodes';

export function serialize(doc: RepresentationNode) {
  const cache = new Map<RepresentationNode, SerializationValueNode>();
  let anchorIndex = 0;

  function rec(node: RepresentationNode): SerializationNode {
    const x = cache.get(node);
    if (x !== undefined) {
      if (x.anchor === null) {
        x.anchor = (anchorIndex++).toString();
      }
      return new Alias(x.anchor);
    }

    if (node.kind === 'scalar') {
      const ret = new SerializationScalar(node.tag, node.content);
      cache.set(node, ret);
      return ret;
    } else if (node.kind === 'sequence') {
      const ret = new SerializationSequence(node.tag, []);
      cache.set(node, ret);
      for (const child of node) {
        ret.content.push(rec(child));
      }
      return ret;
    } else if (node.kind === 'mapping') {
      const ret = new SerializationMapping(node.tag, []);
      cache.set(node, ret);
      for (const [key, value] of node) {
        ret.content.push([rec(key), rec(value)]);
      }
      return ret;
    } else {
      throw new Error('unreachable');
    }
  }

  return rec(doc);
}
