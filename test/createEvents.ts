import { loadTestCase } from './cases';

const testCase = process.argv[2];
if (testCase === undefined) throw new Error('expected testCase');

const text = loadTestCase(testCase);

// console.log(text);

/////

import { parseStream } from '@/parser';
import { serializationTreeToEvents, stringifyEvent } from '@/events';

const serializationTrees = parseStream(text);
const events = serializationTreeToEvents(serializationTrees);

// console.log(events);
for (const event of events) {
  console.log(stringifyEvent(event));
}
