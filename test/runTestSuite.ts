import path from 'path';
import chalk from 'chalk';

import { parseStream } from '@/parser';
import { zip } from '@/util';

import { diffSerializations, pathToString, type Difference } from '@/nodes/diff';

import {
  DirectoryTestLoader,
  eventsToSerializationTree,
  type TestCase,
} from './testSuite';

import { Logger } from './logger';

const logger = new Logger(process.stdout);

const testLoader = new DirectoryTestLoader(path.join(__dirname, '../..', 'yaml-test-suite'));


interface TestResult {
  test: TestCase;
  inequal?: Difference[];
  error?: unknown;
}

function runTest(test: TestCase) {
  function makeResult(status: string, rest: Partial<TestResult> = {}) {
    return {
      status,
      test,
      ...rest,
    };
  }

  if (test.skip) return makeResult('skipped');
  if (test.fail) return makeResult('skipped'); // TODO
  if (test.tree === undefined) return makeResult('skipped'); // TODO

  try {
    const expectedTree = eventsToSerializationTree(test.tree);
    const actualTree = Array.from(parseStream(test.yaml));

    const inequal = [] as Difference[];
    for (const [expectedDocument, actualDocument] of zip(
      expectedTree,
      actualTree,
    )) {
      inequal.push(...diffSerializations(expectedDocument, actualDocument));
    }
    const status = inequal.length > 0 ? 'failure' : 'success';
    return makeResult(status, { inequal });
  } catch (error) {
    return makeResult('error', { error });
  }
}

const VERBOSE = false;

let testNames = process.argv.slice(2);
if (testNames.length === 0) {
  testNames = testLoader.listTests();
}

for (const testName of testNames) {
  const tests = testLoader.loadTest(testName);
  for (const test of tests) {
    const result = runTest(test);

    const bad = result.status !== 'success' && result.status !== 'skipped';

    if (VERBOSE || bad) {
      logger.log();
      logger.log(`${test.id}: ${test.name}`);

      logger.indented(() => {
        logger.log(chalk.gray(test.yaml));

        for (const { path, expected, actual, message } of result.inequal ?? []) {
          logger.log(`${pathToString(path)}: ${message}`);
          logger.indented(() => {
            logger.log('expected:', expected);
            logger.log('actual  :', actual);
          });
        }

        if (result.error) {
          // logger.log(chalk.red(inspect(result.error)));
          logger.log(chalk.red(result.error));
        }
      });
    }
  }
}
