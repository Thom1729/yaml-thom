import { handleDoubleEscapes } from '@/parser/core/scalarContent';

import { NonSpecificTag, type SerializationNode, type SerializationTag } from '@/nodes';

import {
  Alias, SerializationScalar, SerializationSequence, SerializationMapping,
} from '@/nodes';

import { parseEvent } from './parseEvent';

export function *eventsToSerializationTree(events: string, index: number = 0) {
  const parsedEvents = events
    .trimEnd()
    .split('\n')
    .map(parseEvent);

  function error(): never {
    throw new TypeError(`Unexpected event ${parsedEvents[index].type}`);
  }

  function recurse(): SerializationNode {
    const { type, anchor, tag, valueStyle, value } = parsedEvents[index++];

    if (type === '=ALI') {
      return new Alias(value as string);
    }

    let t: SerializationTag;
    if (tag === '!') {
      t = NonSpecificTag.exclamation;
    } else if (tag !== undefined) {
      t = tag;
    } else if (valueStyle === '\'' || valueStyle === '"' || valueStyle === '|' || valueStyle === '>') {
      t = NonSpecificTag.exclamation;
    } else {
      t = NonSpecificTag.question;
    }

    let node: SerializationNode;
    if (type === '=VAL') {
      node = new SerializationScalar(t, handleDoubleEscapes((value as string).replace(/␣/g, ' ')));
    } else if (type === '+SEQ') {
      const items: SerializationNode[] = [];
      while (parsedEvents[index].type !== '-SEQ') {
        items.push(recurse());
      }
      index++;
      node = new SerializationSequence(t, items);
    } else if (type === '+MAP') {
      const items: [SerializationNode, SerializationNode][] = [];
      while (parsedEvents[index].type !== '-MAP') {
        const k = recurse();
        const v = recurse();
        items.push([k, v]);
      }
      index++;
      node = new SerializationMapping(t, items);
    } else {
      error();
    }

    if (anchor !== undefined) {
      node.anchor = anchor;
    }

    return node;
  }

  if (parsedEvents[index].type !== '+STR') error();
  index++;

  while (parsedEvents[index].type === '+DOC') {
    index++;

    yield recurse();

    if (parsedEvents[index].type !== '-DOC') error();
    index++;
  }

  if (parsedEvents[index].type !== '-STR') error();
}
