import chalk from 'chalk';

import { findTestFiles, enumerate, readText } from './helpers';
import { Logger } from './logger';
import { validationProvider } from './validators';
import type { PresentationTest as RawPresentationTest } from '@validators';

import {
  loadStream, dumpDocument,
  type RepresentationNode,
  defaultConstructor,
  DumpOptions,
} from '@/index';

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
    const text = await readText(name);
    logger.log(name);

    logger.indented(() => {
      for (const [index, doc] of enumerate(loadStream(text), 1)) {
        const test = constructTest(doc);

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
