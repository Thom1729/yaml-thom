import chalk from 'chalk';
import { inspect } from 'util';

import { parseStream, serializationTreeToEvents } from '@';

import { DirectoryTestLoader, type TestCase } from './DirectoryTestLoader';
import { Logger, command, deepEquals } from '../util';

const logger = new Logger(process.stdout);

export const runTestSuite = command<{
  testSuitePath: string,
  testName: string[],
  verbose: boolean,
}>(async ({
  testSuitePath,
  testName: testNames,
  verbose,
}) => {
  const testLoader = new DirectoryTestLoader(testSuitePath);
  if (testNames.length === 0) testNames = await testLoader.listTests();

  for (const testName of testNames) {
    const tests = testLoader.loadTest(testName);
    for await (const test of tests) {
      const result = runTest(test);

      const bad = result.status !== 'success' && result.status !== 'skipped';

      if (verbose || bad) {
        logger.log();
        logger.log(`${test.id}: ${test.name}`);

        logger.indented(() => {
          if (result.error) {
            logger.log(chalk.red(inspect(result.error)));
          }
        });
      }
    }
  }
});

export interface TestResult {
  status: 'success' | 'failure' | 'error' | 'skipped';
  test: TestCase;
  error?: unknown;
}

export function runTest(test: TestCase): TestResult {
  function makeResult(status: 'success' | 'failure' | 'error' | 'skipped', rest: Partial<TestResult> = {}) {
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
    const expectedEvents = test.tree;
    const serializationTree = parseStream(test.yaml, { version: '1.3' });
    const actualEvents = Array.from(serializationTreeToEvents(serializationTree));

    if (expectedEvents.length !== actualEvents.length) {
      console.error(`Expected ${expectedEvents.length} events but got ${actualEvents.length}`);
    }

    if (!deepEquals(expectedEvents, actualEvents)) {
      console.log('expected', expectedEvents);
      console.log('actual', actualEvents);
      return makeResult('failure');
    } else {
      return makeResult('success');
    }
  } catch (error) {
    return makeResult('error', { error });
  }
}
