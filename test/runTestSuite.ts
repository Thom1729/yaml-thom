import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import { inspect } from 'util';

import {
  DirectoryTestLoader,
} from './testSuite';

import { runTest } from '@/testSuite';
import { pathToString } from '@/nodes/diff';


import { Logger } from './logger';

const logger = new Logger(process.stdout);

const TEST_SUITE_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..', 'yaml-test-suite',
);
const testLoader = new DirectoryTestLoader(TEST_SUITE_PATH);

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
          logger.log(chalk.red(inspect(result.error)));
          // logger.log(chalk.red(result.error));
        }
      });
    }
  }
}
