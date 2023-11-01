import chalk from 'chalk';
import { inspect } from 'util';

import { runTest, present, type PathEntry, type SerializationNode } from '../lib';

import { DirectoryTestLoader } from './DirectoryTestLoader';

import { Logger } from '../logger';

export function pathToString(path: PathEntry<SerializationNode>[]) {
  return '/' + path
    .map(entry => {
      if (entry === null) {
        return 'key';
      } else if (typeof entry === 'number') {
        return entry;
      } else {
        return present(entry);
      }
    })
    .join('/');
}

export function runTestSuite(testSuitePath: string, testNames: string[], verbose: boolean) {
  const logger = new Logger(process.stdout);

  const testLoader = new DirectoryTestLoader(testSuitePath);
  if (testNames.length === 0) testNames = testLoader.listTests();
  for (const testName of testNames) {
    const tests = testLoader.loadTest(testName);
    for (const test of tests) {
      const result = runTest(test);

      const bad = result.status !== 'success' && result.status !== 'skipped';

      if (verbose || bad) {
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
}
