import { loadText } from '..';
import { loadStream } from '@/index';
import {
  RepresentationMapping,
  type RepresentationNode,
} from '@/nodes';

import { evaluate } from '@/evaluator';
import { prettyPrint } from '../prettyPrint';
import { diff } from '@/nodes/diff';

import { extractMapEntries, extractStringMap } from '@/evaluator/helpers';

interface AnnotationTest {
  name: string;
  context: readonly (readonly [RepresentationNode, RepresentationNode])[];
  input: RepresentationNode;
  expected: RepresentationNode | undefined;
  error: boolean | undefined;
}

function *loadAnnotationTest(name: string): Generator<AnnotationTest> {
  const inputText = loadText('evaluate', 'annotations', `${name}.yaml`);
  for (const test of loadStream(inputText, { version: '1.3' })) {
    const testProperties = extractStringMap(test, ['context?', 'input', 'expected?', 'error?']);

    yield {
      name,
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

import { Logger } from '../logger';

const logger = new Logger(process.stdout);

import path from 'path';
import fs from 'fs';

let [, , ...testNames] = process.argv;

if (testNames.length === 0) {
  testNames = fs.readdirSync(path.join(__dirname, 'annotations'))
    .filter(s => s.endsWith('.yaml'))
    .map(s => s.slice(0, -5));
}


for (const testName of testNames) {
  for (const test of loadAnnotationTest(testName)) {
    const { status, diffs, error } = runAnnotationTest(test);

    if (status !== 'success') {
      logger.log(testName);

      logger.indented(() => {
        if (error) {
          logger.log(error);
        }
        if (diffs?.length) {
          for (const { path, actual, expected, message } of diffs) {
            logger.log(`${path}: ${message}`);
            logger.log('Actual');
            prettyPrint(logger.write.bind(logger), actual);
            logger.log('Expected');
            prettyPrint(logger.write.bind(logger), expected);
          }
        }
      });
    }
  }
}
