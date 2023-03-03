import { loadTestCase } from './cases';

const [, , testName] = process.argv;

import { Logger } from './logger';
const logger = new Logger(process.stdout);

const inputText = loadTestCase(testName);

logger.log('Input text:');
logger.indented(() => logger.logCode(inputText));

/////////

import { GRAMMAR } from '../src/parser/grammar';
import { ParseOperation } from '../src/parser/parser';
import { astToSerializationTree } from '../src/parser/astToSerializationTree';
import { serialize } from '../src/serializer';

const ast = new ParseOperation(GRAMMAR, inputText).parseAll('yaml-stream');

const serializationTree = Array.from(astToSerializationTree(inputText, ast))[0];

//////////

import { compose } from '../src/composer';

const representationGraph = compose(serializationTree);

//////////

const serialized = serialize(representationGraph);

import { PresentOperation } from '../src/presenter';

const op = new PresentOperation();

op.presentDocument(serialized);

logger.log('Presented:')
logger.indented(() => logger.log(op.result.join('')));
