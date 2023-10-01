#!/usr/bin/env node

import { readFileSync } from 'fs';
import { parseStream, serializationTreeToEvents, stringifyEvent } from '../dist/esm/index.js';

const [, , filename] = process.argv;

if (filename === undefined) throw new TypeError('missing filename');

const text = readFileSync(filename, { encoding: 'utf-8' });

for (const event of serializationTreeToEvents(parseStream(text))) {
  console.log(stringifyEvent(event));
}
