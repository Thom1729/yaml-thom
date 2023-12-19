import {
  command,
  enumerate,
  loadTestFiles,
  logger,
} from '../helpers';

import {
  loadStream,
  defaultConstructor,
  validate, constructValidator, type Validator, type ValidationFailure,
  type RepresentationNode,
  assertValid,
  type PathEntry,
} from '@/index';

import { extractTypedStringMap } from '@/helpers';

interface ValidationTest {
  validator: Validator;
  input: RepresentationNode;
  valid?: boolean;
  failures?: ValidationFailure[];
}

interface ValidationTestResult {
  success: boolean;
}

import * as V from '@/validator/validatorHelpers';
import { assertNotUndefined } from '@/util';
import chalk from 'chalk';

const testValidator = V.stringMapOf({
  validator: {},
  input: {},
  'valid?': V.bool,
  'failures?': {},
});

function constructValidationTest(document: RepresentationNode): ValidationTest {
  assertValid(testValidator, document);
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

const failuresValidator = V.seqOf(V.stringMapOf({
  path: V.seq,
  key: V.str,
  'children?': {},
}));

function constructTestFailures(failures: RepresentationNode): ValidationFailure[] {
  assertValid(failuresValidator, failures);
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

const pathEntryValidator = V.stringMapOf({
  type: V.str,
  'index?': V.int,
  'key?': {},
  'value?': {},
});

function constructPathEntry(entry: RepresentationNode): PathEntry {
  assertValid(pathEntryValidator, entry);
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
  const failures = Array.from(validate(test.validator, test.input));
  const valid = failures.length === 0;

  const result: ValidationTestResult = {
    success: true,
  };

  if (test.valid !== undefined) {
    if (test.valid !== valid) result.success = false;
  }

  if (test.failures !== undefined) {
    result.success = result.success && deepEquals(failures, test.failures);
  }
  return result;
}

export const runValidationTests = command<{
  testName: string[],
}>(({ testName }) => {
  let status = 1;
  for (const { name, text } of loadTestFiles('test/validation', testName)) {
    logger.log(name);
    logger.indented(() => {
      for (const [index, doc] of enumerate(loadStream(text), 1)) {
        const validationTest = constructValidationTest(doc);

        const result = runValidationTest(validationTest);

        logger.write(index.toString() + ' ');
        if (result.success) {
          logger.log(chalk.green('success'));
        } else {
          status = 1;
          logger.log(chalk.red('failure'));
        }
      }
    });
    logger.log();
  }
  return status ;
});
