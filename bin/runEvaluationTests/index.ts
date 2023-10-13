import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { inspect } from 'util';

import chalk from 'chalk';

import {
  loadStream,
  RepresentationMapping, type RepresentationNode,
  evaluate,
  diff,
  extractMapEntries, extractStrContent, extractStringMap,
} from '../lib';

import { prettyPrint } from './prettyPrint';
import { Logger } from '../logger';

const BASE_TEST_PATH = path.join(
  fileURLToPath(import.meta.url),
  '../../test/annotations',
);

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

function *loadAnnotationTest(suiteName: string): Generator<AnnotationTest> {
  const inputText = fs.readFileSync(path.join(BASE_TEST_PATH, `${suiteName}.yaml`), { encoding: 'utf-8' });
  for (const test of loadStream(inputText, { version: '1.3' })) {
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

  if (suiteNames.length === 0) {
    suiteNames = fs.readdirSync(BASE_TEST_PATH).map(f => f.slice(0, -5));
  }

  for (const suiteName of suiteNames) {
    logger.log(suiteName);

    logger.indented(() => {
      for (const [i, test] of enumerate(loadAnnotationTest(suiteName), 1)) {
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
