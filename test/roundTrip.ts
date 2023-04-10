import { loadTestCase } from './cases';

const [, , testName] = process.argv;

if (testName === undefined) {
  console.error('No test name given');
  process.exit(1);
}

import { prettyPrint } from './prettyPrint';
import { Logger } from './logger';
const logger = new Logger(process.stdout);

const inputText = loadTestCase(testName);

logger.log('Input text:');
logger.indented(() => logger.logCode(inputText));

/////////

import { serialize } from '@/serializer';
import { parseSingleDocument } from '@/parser';

const serializationTree = parseSingleDocument(inputText, { version: '1.3' });

//////////

import { compose } from '@/composer';

const representationGraph = compose(serializationTree);

//////////

const serialized = serialize(representationGraph);

logger.log('\nPresented:');
prettyPrint(logger.write.bind(logger), serialized);
