import chalk from 'chalk';
import { inspect } from 'util';

import { runTest, present, type PathEntry, type SerializationNode } from '@';

import { DirectoryTestLoader } from './DirectoryTestLoader';

import { Logger, command } from '../util';

export function pathToString(path: PathEntry<SerializationNode>[]) {
  return '/' + path
    .map(entry => {
      if (entry.type === 'key') {
        return 'key';
      } else if (entry.type === 'index') {
        return entry.index;
      } else {
        return present(entry.key);
      }
    })
    .join('/');
}

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
          if (result.inequal?.length) {
            logger.log(chalk.gray(test.yaml));

            for (const { path, expected, actual, message } of result.inequal ?? []) {
              logger.log(`${pathToString(path)}: ${message}`);
              logger.indented(() => {
                logger.log('expected:', expected);
                logger.log('actual  :', actual);
              });
            }
          }

          if (result.error) {
            logger.log(chalk.red(inspect(result.error)));
          }
        });
      }
    }
  }
});
