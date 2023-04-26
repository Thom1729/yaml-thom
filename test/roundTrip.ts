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
logger.logCode(inputText);

/////////

import { loadSingleDocument, dumpDocument } from '@/index';

const representationGraph = loadSingleDocument(inputText, { version: '1.3' });
const presented = dumpDocument(representationGraph, { indentation: 4 });

logger.log('\nPresented:');
logger.logCode(presented);
