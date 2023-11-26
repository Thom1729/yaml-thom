import chalk from 'chalk';

import { loadTestFiles, enumerate } from './helpers';
import { Logger } from './logger';

import {
  loadStream, dumpDocument,
  assertValid,
  NodeMap,
  type RepresentationNode,
  type Validator,
} from '@/index';

import { str } from '@/helpers';

const presenterTestValidator = {
  kind: ['mapping'],
  tag: ['tag:yaml.org,2002:map'],

  properties: new NodeMap([
    [str('name'), {
      kind: ['scalar'],
      tag: ['tag:yaml.org,2002:str'],
    }],
    [str('input'), {}],
    [str('expected'), {
      kind: ['scalar'],
      tag: ['tag:yaml.org,2002:str'],
    }],
  ]),
} as const satisfies Validator;

function constructTest(node: RepresentationNode) {
  assertValid(presenterTestValidator, node);

  const name = node.get(str('name'))?.content;
  const input = node.get(str('input'))!;
  const expected = node.get(str('expected'))!.content;

  return {
    name,
    input,
    expected,
  };
}

function runTest(test: ReturnType<typeof constructTest>) {
  try {
    const actual = dumpDocument(test.input);
    return {
      status: actual === test.expected ? 'success' : 'failure',
      actual,
    } as const;
  } catch (error) {
    return {
      status: 'error',
      error,
    } as const;
  }
}

export function runPresentTests(suiteNames: string[]) {
  const logger = new Logger(process.stdout);
  for (const { name, text } of loadTestFiles('test/present', suiteNames)) {
    logger.log(name);

    logger.indented(() => {
      for (const [index, doc] of enumerate(loadStream(text), 1)) {
        const test = constructTest(doc);

        logger.write((test.name ?? index.toString()) + ' ');

        const result = runTest(test);

        if (result.status === 'success') {
          logger.log(chalk.green('success'));
        } else if (result.status === 'failure') {
          logger.log(chalk.red('failure'));

          logger.log('expected:');
          logger.logCode(test.expected);
          logger.log('actual:');
          logger.logCode(result.actual);
        } else {
          logger.log(chalk.red('error'));
          logger.log(result.error);
        }
      }
    });
  }
}
