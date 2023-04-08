import { loadTestCase } from './cases';

const [, , testName] = process.argv;

if (testName === undefined) {
  console.error('No test name given');
  process.exit(1);
}

import { Logger } from './logger';
const logger = new Logger(process.stdout);

const inputText = loadTestCase(testName);

logger.log('Input text:');
logger.indented(() => logger.logCode(inputText));

/////////

import { serialize } from '@/serializer';
import { parseStream } from '@/parser';

const serializationTree = Array.from(parseStream(inputText, { version: '1.3' }))[0];

//////////

import { compose } from '@/composer';

const representationGraph = compose(serializationTree);

//////////

const serialized = serialize(representationGraph);

import { present } from '@/presenter';

const result = present(serialized);

logger.log('\nPresented:');
logger.indented(() => logger.logCode(result));
