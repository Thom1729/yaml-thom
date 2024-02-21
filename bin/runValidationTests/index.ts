import {
  command,
  enumerate,
  loadTestFiles,
  logger,
} from '../helpers';

import { validationProvider } from '../validators';
validationProvider;

import type {
  ValidationTest as RawValidationTest,
  ValidationFailures,
  PathEntry as RawPathEntry,
} from '@validators';

import {
  loadStream,
  defaultConstructor,
  validate, constructValidator, type Validator, type ValidationFailure,
  type RepresentationNode,
  type PathEntry,
} from '@/index';

import { extractTypedStringMap } from '@/helpers';

interface ValidationTest {
  validator: Validator;
  input: RepresentationNode;
  valid?: boolean;
  failures?: ValidationFailure[];
}

type ValidationTestResult =
| { status: 'success' }
| { status: 'failure', expected: readonly ValidationFailure[], actual: readonly ValidationFailure[] }
;

import { assertNotUndefined } from '@/util';
import chalk from 'chalk';

function constructValidationTest(document: RawValidationTest): ValidationTest {
  const x = extractTypedStringMap(document);

  const ret: ValidationTest = {
    validator: constructValidator(x.validator),
    input: x.input,
  };

  if (x.valid !== undefined) ret.valid = defaultConstructor(x.valid) as boolean;
  if (x.failures !== undefined) {
    ret.failures = constructTestFailures(x.failures);
  }

  return ret;
}

function constructTestFailures(failures: ValidationFailures): ValidationFailure[] {
  return Array.from(failures).map(failure => {
    const y = extractTypedStringMap(failure);

    const ret: ValidationFailure = {
      path: Array.from(y.path).map(constructPathEntry),
      key: y.key.content as ValidationFailure['key'],
    };

    if (y.children) {
      ret.children = constructTestFailures(y.children);
    }

    return ret;
  });
}

function constructPathEntry(entry: RawPathEntry): PathEntry {
  const z = extractTypedStringMap(entry);
  const type = z.type.content;
  if (type === 'index') {
    assertNotUndefined(z.index);
    return { type, index: Number(z.index.content) };
  } else if (type === 'key') {
    assertNotUndefined(z.key);
    return { type, key: z.key };
  } else if (type === 'value') {
    assertNotUndefined(z.key);
    return { type, key: z.key };
  } else {
    throw new TypeError(type);
  }
}

// Not cycle-safe!
function deepEquals(a: unknown, b: unknown) {
  if (a === b) {
    return true;
  } else if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;

    for (let i = 0; i < a.length; i++) {
      if (!deepEquals(a[i], b[i])) return false;
    }

    return true;
  } else if (a && b && typeof a === 'object' && typeof b === 'object') {
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    if (aKeys.length !== bKeys.length) return false;
    for (const k of aKeys) {
      if (!Object.hasOwn(b, k)) return false;
      if (!deepEquals((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k])) return false;
    }
    return true;
  } else {
    return false;
  }
}

function runValidationTest(test: ValidationTest): ValidationTestResult {
  const expected = test.failures ?? [];
  const actual = Array.from(validate(test.validator, test.input));
  const valid = actual.length === 0;

  const status = (
    (test.valid === undefined || valid === test.valid) &&
    (test.failures === undefined || deepEquals(actual, expected))
  ) ? 'success' : 'failure';

  if (status === 'success') {
    return { status };
  } else {
    return { status, expected, actual };
  }
}

export const runValidationTests = command<{
  testName: string[],
}>(({ testName }) => {
  let status = 0;
  for (const { name, text } of loadTestFiles('test/validation', testName)) {
    logger.log(name);
    logger.indented(() => {
      for (const [index, doc] of enumerate(loadStream(text), 1)) {
        validationProvider.assertValid(
          validationProvider.getValidatorById('#validationTest'),
          doc,
        );
        const validationTest = constructValidationTest(doc as RawValidationTest);

        const result = runValidationTest(validationTest);

        logger.write(index.toString() + ' ');
        if (result.status === 'success') {
          logger.log(chalk.green('success'));
        } else {
          status = 1;
          logger.log(chalk.red('failure'));
          logger.log('expected');
          logFailures(result.expected);
          logger.log('actual');
          logFailures(result.actual);
        }
      }
    });
    logger.log();
  }
  return status;
});

function logFailures(failures: readonly ValidationFailure[]) {
  logger.indented(() => {
    for (const failure of failures) {
      logger.write(`- ${failure.key} `);
      logger.log(['#', ...failure.path.map(formatPathEntry)].join(' → '));
      if (failure.children) logFailures(failure.children);
    }
  });
}

import { dumpDocument } from '@/index';

const options = {
  flow: true,
  versionDirective: false,
  startMarker: false,
  endMarker: false,
  trailingNewline: false,
};

function formatPathEntry(entry: PathEntry) {
  switch (entry.type) {
    case 'index': return entry.index.toString();
    case 'value': return dumpDocument(entry.key, options);
    case 'key': throw new Error('nimpl');
  }
}
