import chalk from 'chalk';

import { loadTestFiles, enumerate } from './helpers';
import { Logger } from './logger';

import {
  loadStream, dumpDocument,
  assertValid,
  type RepresentationNode,
  defaultConstructor,
  DumpOptions,
} from '@/index';

import * as V from '@/validator/validatorHelpers';

import { str, extractTypedStringMap } from '@/helpers';

const presenterTestValidator = V.stringMapOf({
  'name?': V.str,
  'options?': V.stringMapOf({
    'scalarStyle?': V.seqOf({
      enum: [str('plain'), str('double')],
    }),
    'doubleQuoteEscapeStyle?': V.seqOf({
      enum: [str('builtin'), str('x'), str('u'), str('U'), str('surrogate')],
    }),
  }),
  input: {},
  expected: V.str,
});

function constructTest(node: RepresentationNode) {
  assertValid(presenterTestValidator, node);
  const x = extractTypedStringMap(node);

  return {
    name: x.name?.content,
    options: x.options && (defaultConstructor(x.options) as DumpOptions),
    input: x.input,
    expected: x.expected.content,
  };
}

function runTest(test: ReturnType<typeof constructTest>) {
  try {
    const actual = dumpDocument(test.input, test.options ?? undefined);
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

          logger.indented(() => {
            logger.log('expected:');
            logger.logCode(test.expected);
            logger.log('actual:');
            logger.logCode(result.actual);
          });
        } else {
          logger.log(chalk.red('error'));
          logger.log(result.error);
        }
      }
    });
  }
}
