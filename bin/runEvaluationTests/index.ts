import { inspect } from 'util';

import chalk from 'chalk';

import {
  loadStream,
  RepresentationMapping, type RepresentationNode,
  evaluate,
  diff,
} from '@/index';

import { extractMapEntries, extractStrContent, extractStringMap } from '@/helpers';

import { prettyPrint } from './prettyPrint';
import { Logger } from '../logger';
import { loadTestFiles } from '../helpers';

export function *enumerate<T>(iterable: Iterable<T>, start: number = 0) {
  let i = start;
  for (const item of iterable) {
    yield [i++, item] as const;
  }
}

interface AnnotationTest {
  name?: string;
  context: readonly (readonly [RepresentationNode, RepresentationNode])[];
  input: RepresentationNode;
  expected: RepresentationNode | undefined;
  error: boolean | undefined;
}

function *loadAnnotationTest(text: string): Generator<AnnotationTest> {
  for (const test of loadStream(text, { version: '1.3' })) {
    const testProperties = extractStringMap(test, ['context?', 'input', 'expected?', 'error?', 'name?']);

    yield {
      name: testProperties.name && extractStrContent(testProperties.name),
      input: testProperties.input,
      expected: testProperties.expected,
      context: testProperties.context ? extractMapEntries(testProperties.context) : [],
      error: Boolean(testProperties.error),
    };
  }
}

function runAnnotationTest(test: AnnotationTest) {
  let status: 'success' | 'failure' = 'success';
  let actual = null;
  let error = null;

  const context = new RepresentationMapping('tag:yaml.org,2002:map', test.context);
  try {
    actual = evaluate(test.input, context);
  } catch (e) {
    error = e;
    if (!test.error) status = 'failure';
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
} as const;

export function runEvaluationTests(suiteNames: string[]) {
  const logger = new Logger(process.stdout);

  for (const { name, text } of loadTestFiles('test/annotations', suiteNames)) {
    logger.log(name);
    logger.indented(() => {
      for (const [i, test] of enumerate(loadAnnotationTest(text), 1)) {
        const testName = test.name ?? i;

        const { status, diffs, error } = runAnnotationTest(test);

        logger.write(testName + ' ');
        logger.log(chalk[STATUS_COLORS[status]](status));

        if (status !== 'success') {
          if (error) logger.log(chalk.red(inspect(error)));
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
