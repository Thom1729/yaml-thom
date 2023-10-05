import { readFileSync } from 'fs';

import {
  parseStream, serializationTreeToEvents, stringifyEvent,
  type YamlVersion,
} from './lib';

export function streamToEvents(filename: string, version: YamlVersion) {
  const text = readFileSync(filename, { encoding: 'utf-8' });
  console.log(filename, text);

  for (const event of serializationTreeToEvents(parseStream(text, { version }))) {
    console.log(stringifyEvent(event));
  }
}
