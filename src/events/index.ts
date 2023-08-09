import { handleDoubleEscapes } from '@/parser/core/scalarContent';

import type { SerializationNode } from '@/nodes';

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

    if (event.type === '=VAL') {
      return new SerializationScalar(
        event.tag,
        handleDoubleEscapes(event.value.replace(/␣/g, ' ')),
        event.anchor ?? null,
      );
    } else if (event.type === '+SEQ') {
      const items: SerializationNode[] = [];
      while (parsedEvents[index].type !== '-SEQ') {
        items.push(recurse());
      }
      index++;
      return new SerializationSequence(
        event.tag,
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
      return new SerializationMapping(
        event.tag,
        items,
        event.anchor ?? null,
      );
    } else {
      error();
    }
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
