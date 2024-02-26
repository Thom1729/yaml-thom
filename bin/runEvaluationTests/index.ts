import { inspect } from 'util';

import chalk from 'chalk';

import {
  loadStream,
  RepresentationMapping, type RepresentationNode,
  evaluate,
  diff,
} from '@/index';

import { extractTypedStringMap } from '@/helpers';

import { prettyPrint } from './prettyPrint';
import { Logger } from '../logger';
import { findTestFiles, readText, enumerate } from '../helpers';

import { validationProvider } from '../validators';
import type { EvaluationTest as RawEvaluationTest } from '@validators';

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
  let status: 'success' | 'failure' = 'success';
  let actual = null;
  let error = null;

  const context = test.context ?? new RepresentationMapping('tag:yaml.org,2002:map', []);
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

export async function runEvaluationTests(suiteNames: string[]) {
  const logger = new Logger(process.stdout);

  for (const name of await findTestFiles(['test', 'annotations'], suiteNames)) {
    logger.log(name);
    await logger.indented(async () => {
      const text = await readText(name);

      for (const [i, doc] of enumerate(loadStream(text, { version: '1.3' }), 1)) {
        validationProvider.assertValid(validationProvider.getValidatorById('#evaluationTest'), doc);
        const test = constructAnnotationTest(doc as RawEvaluationTest);

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
