import chalk from 'chalk';

import { loadTestFiles } from './helpers';
import { Logger } from './logger';

import {
  loadSingleDocument, dumpDocument,
  assertValid,
  NodeMap,
  type RepresentationNode,
  type Validator,
  str,
} from '@/index';

const presenterTestValidator = {
  kind: ['mapping'],
  tag: ['tag:yaml.org,2002:map'],

  properties: new NodeMap([
    [str('input'), {}],
    [str('expected'), {
      kind: ['scalar'],
      tag: ['tag:yaml.org,2002:str'],
    }],
  ]),
} as const satisfies Validator;

function constructTest(node: RepresentationNode) {
  assertValid(presenterTestValidator, node);

  const input = node.get(str('input'))!;
  const expected = node.get(str('expected'))!.content;

  return {
    input,
    expected,
  };
}

export function runPresentTests(suiteNames: string[]) {
  const logger = new Logger(process.stdout);
  for (const { name, text } of loadTestFiles('test/present', suiteNames)) {
    logger.log(name);

    const test = loadSingleDocument(text);

    const { input, expected } = constructTest(test);

    const actual = dumpDocument(input);

    if (actual !== expected) {
      logger.log(chalk.red('failure'));
      logger.log('expected:');
      logger.logCode(expected);
      logger.log('actual:');
      logger.logCode(actual);
    }
  }
}
