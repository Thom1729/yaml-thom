import chalk from 'chalk';

import { loadTestFiles, enumerate } from './helpers';
import { Logger } from './logger';

import {
  loadStream, dumpDocument,
  assertValid,
  type RepresentationNode,
  defaultConstructor,
  DumpOptions,
  type Validator,
} from '@/index';

import * as V from '@/validator/validatorHelpers';

import { str, extractTypedStringMap } from '@/helpers';

function singleOrArray<V extends Validator>(validator: V) {
  return {
    anyOf: [validator, V.seqOf(validator)],
  } satisfies Validator;
}

const presenterTestValidator = V.stringMapOf({
  'name?': V.str,
  'options?': V.stringMapOf({
    'unresolve?': singleOrArray(V.enumOf(str('!'), str('?'))),
    'scalarStyle?': singleOrArray(V.enumOf(str('plain'), str('double'))),
    'doubleQuoteEscapeCharacters?': singleOrArray(V.enumOf(str('all'))),
    'doubleQuoteEscapeStyle?': singleOrArray(V.enumOf(str('builtin'), str('json'), str('x'), str('u'), str('U'), str('uu'))),

    'versionDirective?': V.bool,
    'startMarker?': V.bool,
    'endMarker?': V.bool,
    'trailingNewline?': V.bool,

    'tagShorthands?': V.seqOf(V.seqOf(V.str)),
    'useDefaultTagShorthands?': V.bool,
  }),
  input: {},
  expected: V.str,
});

function constructTest(node: RepresentationNode) {
  assertValid(presenterTestValidator, node);
  const x = extractTypedStringMap(node);

  return {
    name: x.name?.content,
    options: x.options && (defaultConstructor(x.options) as Partial<DumpOptions>),
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

export async function runPresentTests(suiteNames: string[]) {
  const logger = new Logger(process.stdout);
  for await (const { name, text } of loadTestFiles('test/present', suiteNames)) {
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
