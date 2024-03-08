import { inspect } from 'util';

import chalk from 'chalk';

import {
  RepresentationMapping, type RepresentationNode,
  evaluate,
  diff,
  EvaluationError,
} from '@';

import { extractTypedStringMap } from '@/helpers';

import { prettyPrint } from './prettyPrint';
import { logger, findTestFiles, readStream } from '../util';

import type { EvaluationTest as RawEvaluationTest } from '../testValidators';

interface AnnotationTest {
  name?: string;
  context?: RepresentationMapping<'tag:yaml.org,2002:map'>;
  input: RepresentationNode;
  expected: RepresentationNode | undefined;
  error: boolean | undefined;
}

function constructAnnotationTest(test: RawEvaluationTest): AnnotationTest {
  const x = extractTypedStringMap(test);

  return {
    name: x.name?.content,
    input: x.input,
    expected: x.expected,
    context: x.context,
    error: Boolean(x.error),
  };
}

function runAnnotationTest(test: AnnotationTest) {
  let status: 'success' | 'failure' | 'error' = 'success';
  let actual = null;
  let error = null;

  const context = test.context ?? new RepresentationMapping('tag:yaml.org,2002:map', []);
  try {
    actual = evaluate(test.input, context);
  } catch (e) {
    error = e;
    if (!test.error) status = 'error';
  }

  const diffs = actual !== null && test.expected !== undefined
    ? Array.from(diff(test.expected, actual))
    : null;

  if (diffs?.length) status = 'failure';

  return { status, actual, diffs, error };
}

//////////

const STATUS_COLORS = {
  success: 'green',
  failure: 'red',
  error: 'red',
} as const;

function printError(error: unknown) {
  if (error instanceof EvaluationError) {
    logger.log(chalk.red(error.message));
    if (error.annotation) {
      const { name, arguments: args, value } = error.annotation;
      logger.log(`name: ${name}`);
      if (args.length > 0) {
        logger.log('arguments:');
        logger.indented(() => {
          for (const arg of args) {
            prettyPrint(logger.write.bind(logger), arg);
          }
        });
      }
      logger.log('value:');
      logger.indented(() => {
        prettyPrint(logger.write.bind(logger), value);
      });
      if (error.cause) {
        logger.log('cause:');
        logger.indented(() => {
          printError(error.cause);
        });
      }
    }
  } else {
    logger.log(chalk.red(inspect(error)));
  }
}

export async function runEvaluationTests(suiteNames: string[]) {
  for (const name of await findTestFiles(['test', 'annotations'], suiteNames)) {
    logger.log(name);
    await logger.indented(async () => {
      for await (const { index, document } of readStream(name, {
        load: { version: '1.3' },
        validator: { ref: '#evaluationTest' },
      })) {
        const test = constructAnnotationTest(document as RawEvaluationTest);

        const testName = test.name ?? index;

        const { status, diffs, error } = runAnnotationTest(test);

        logger.write(testName + ' ');
        logger.log(chalk[STATUS_COLORS[status]](status));

        if (status !== 'success') {
          if (error) printError(error);
          if (diffs?.length) {
            for (const { path, actual, expected, message } of diffs) {
              logger.log(`${path}: ${message}`);
              logger.log('Actual');
              prettyPrint(logger.write.bind(logger), actual);
              logger.log('Expected');
              prettyPrint(logger.write.bind(logger), expected);
            }
          }
        }
      }
    });
  }
}
