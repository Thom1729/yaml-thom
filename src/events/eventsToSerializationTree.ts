import {
  Alias, SerializationScalar, SerializationSequence, SerializationMapping,
  type SerializationNode,
} from '@/nodes';

import type { ParseEvent } from './parseEvent';
import { iterate } from '@/util';

export function *eventsToSerializationTrees(parsedEvents: Iterable<ParseEvent>) {
  const itr = iterate(parsedEvents);

  function next() {
    const { done, value } = itr.next();
    if (done) {
      throw new TypeError(`Unexpected end of events`);
    } else {
      return value;
    }
  }

  function error(event: ParseEvent): never {
    throw new TypeError(`Unexpected event ${event.type}`);
  }

  const streamBegin = next();
  if (streamBegin.type !== '+STR') error(streamBegin);

  while (true) {
    const event = next();
    if (event.type === '-STR') {
      return;
    } else if (event.type === '+DOC') {
      yield getNode(next());
      const docEnd = next();
      if (docEnd.type !== '-DOC') error(docEnd);
    }
  }

  function getNode(event: ParseEvent): SerializationNode {
    if (event.type === '=ALI') {
      return new Alias(event.value);
    }

    if (event.type === '=VAL') {
      return new SerializationScalar(
        event.tag,
        event.value,
        event.anchor ?? null,
        { style: event.style },
      );
    } else if (event.type === '+SEQ') {
      const items: SerializationNode[] = [];

      while (true) {
        const item = next();
        if (item.type === '-SEQ') break;
        else items.push(getNode(item));
      }
      
      return new SerializationSequence(
        event.tag,
        items,
        event.anchor ?? null,
        { style: event.style },
      );
    } else if (event.type === '+MAP') {
      const items: [SerializationNode, SerializationNode][] = [];

      while (true) {
        const e = next();
        if (e.type === '-MAP') break;

        const k = getNode(e);
        const v = getNode(next());

        items.push([k, v]);
      }

      return new SerializationMapping(
        event.tag,
        items,
        event.anchor ?? null,
        { style: event.style },
      );
    } else {
      error(event);
    }
  }
}
