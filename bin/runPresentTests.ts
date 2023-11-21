import chalk from 'chalk';

import { loadTestFiles } from './helpers';
import { Logger } from './logger';

import { loadSingleDocument, extractStringMap, dumpDocument, extractStrContent } from './lib';

export function runPresentTests(suiteNames: string[]) {
  const logger = new Logger(process.stdout);
  for (const { name, text } of loadTestFiles('test/present', suiteNames)) {
    logger.log(name);

    const test = loadSingleDocument(text);
    const { input, expected } = extractStringMap(test, ['input', 'expected']);
    const expectedText = extractStrContent(expected);

    const actual = dumpDocument(input);

    if (actual !== expectedText) {
      logger.log(chalk.red('failure'));
      logger.log('expected:');
      logger.logCode(expectedText);
      logger.log('actual:');
      logger.logCode(actual);
    }
  }
}
