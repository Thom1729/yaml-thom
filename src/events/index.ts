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
    const event = parsedEvents[index++];

    if (event.type === '=ALI') {
      return new Alias(event.value);
    }

    let node: SerializationNode;
    if (event.type === '=VAL') {
      node = new SerializationScalar(
        getTag(event.tag, event.valueStyle),
        handleDoubleEscapes(event.value.replace(/␣/g, ' ')),
        event.anchor ?? null,
      );
    } else if (event.type === '+SEQ') {
      const items: SerializationNode[] = [];
      while (parsedEvents[index].type !== '-SEQ') {
        items.push(recurse());
      }
      index++;
      node = new SerializationSequence(
        getTag(event.tag, undefined),
        items,
        event.anchor ?? null,
      );
    } else if (event.type === '+MAP') {
      const items: [SerializationNode, SerializationNode][] = [];
      while (parsedEvents[index].type !== '-MAP') {
        const k = recurse();
        const v = recurse();
        items.push([k, v]);
      }
      index++;
      node = new SerializationMapping(
        getTag(event.tag, undefined),
        items,
        event.anchor ?? null,
      );
    } else {
      error();
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

function getTag(tagString: string | undefined, valueStyle: string | undefined) {
  if (tagString === '!') {
    return NonSpecificTag.exclamation;
  } else if (tagString !== undefined) {
    return tagString;
  } else if (valueStyle === '\'' || valueStyle === '"' || valueStyle === '|' || valueStyle === '>') {
    return NonSpecificTag.exclamation;
  } else {
    return NonSpecificTag.question;
  }
}
