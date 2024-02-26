import chalk from 'chalk';

import { findTestFiles, readStream } from './helpers';
import { Logger } from './logger';
import { validationProvider } from './validators';
import type { PresentationTest as RawPresentationTest } from '@validators';

import {
  dumpDocument,
  type RepresentationNode,
  defaultConstructor,
  type DumpOptions,
} from '@';

import { extractTypedStringMap } from '@/helpers';

function constructTest(node: RepresentationNode) {
  validationProvider.assertValid({ ref: '#presentationTest' }, node);
  const x = extractTypedStringMap(node as RawPresentationTest);

  return {
    name: x.name?.content,
    options: x.options && (defaultConstructor(x.options) as Partial<DumpOptions>),
    input: x.input,
    expected: x.expected.content,
  };
}

function runTest(test: ReturnType<typeof constructTest>) {
  try {
    const actual = dumpDocument(test.input, test.options ?? undefined);
    return {
      status: actual === test.expected ? 'success' : 'failure',
      actual,
    } as const;
  } catch (error) {
    return {
      status: 'error',
      error,
    } as const;
  }
}

export async function runPresentTests(suiteNames: string[]) {
  const logger = new Logger(process.stdout);
  for (const name of await findTestFiles('test/present', suiteNames)) {
    logger.log(name);
    await logger.indented(async () => {
      for await (const { index, document } of readStream(name)) {
        const test = constructTest(document);

        logger.write((test.name ?? index.toString()) + ' ');

        const result = runTest(test);

        if (result.status === 'success') {
          logger.log(chalk.green('success'));
        } else if (result.status === 'failure') {
          logger.log(chalk.red('failure'));

          logger.indented(() => {
            logger.log('expected:');
            logger.logCode(test.expected);
            logger.log('actual:');
            logger.logCode(result.actual);
          });
        } else {
          logger.log(chalk.red('error'));
          logger.log(result.error);
        }
      }
    });
  }
}
