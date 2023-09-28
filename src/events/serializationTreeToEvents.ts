import { CollectionStyle, ScalarStyle, type SerializationNode } from '@/nodes';
import type { ParseEvent } from './parseEvent';

export function *serializationTreeToEvents(
  trees: Iterable<SerializationNode>,
): Iterable<ParseEvent> {
  yield { type: '+STR' };
  for (const tree of trees) {
    yield { type: '+DOC' };
    yield* serializationNodeToEvents(tree);
    yield { type: '-DOC' };
  }
  yield { type: '-STR' };
}

function *serializationNodeToEvents(
  node: SerializationNode,
): Iterable<ParseEvent> {
  if (node.kind === 'alias') {
    yield { type: '=ALI', value: node.alias };
  } else if (node.kind === 'scalar') {
    yield {
      type: '=VAL',
      anchor: node.anchor ?? undefined,
      tag: node.tag,
      value: node.content,
      style: node.presentation.style ?? ScalarStyle.double,
    };
  } else if (node.kind === 'sequence') {
    yield {
      type: '+SEQ',
      anchor: node.anchor ?? undefined,
      tag: node.tag,
      style: node.presentation.style ?? CollectionStyle.block,
    };

    for (const item of node) {
      yield* serializationNodeToEvents(item);
    }

    yield { type: '-SEQ' };
  } else if (node.kind === 'mapping') {
    yield {
      type: '+MAP',
      anchor: node.anchor ?? undefined,
      tag: node.tag,
      style: node.presentation.style ?? CollectionStyle.block,
    };
    for (const [key, value] of node) {
      yield* serializationNodeToEvents(key);
      yield* serializationNodeToEvents(value);
    }

    yield { type: '-MAP' };
  }
}
