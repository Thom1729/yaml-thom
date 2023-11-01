import {
  loadTestFiles,
  logger,
} from '../helpers';

import {
  loadStream,
  extractStringMap,
  defaultConstructor,
  validate, constructValidator, type Validator, type ValidationFailure,
  type RepresentationNode,
} from '../lib';

interface ValidationTest {
  validator: Validator;
  input: RepresentationNode;
  valid?: boolean;
  failures?: ValidationFailure[];
}

interface ValidationTestResult {
  success: boolean;
}

function constructValidationTest(document: RepresentationNode): ValidationTest {
  const x = extractStringMap(document, ['validator', 'input', 'valid?', 'failures?']);

  const ret: ValidationTest = {
    validator: constructValidator(x.validator),
    input: x.input,
  };

  if (x.valid !== undefined) ret.valid = defaultConstructor(x.valid) as boolean;
  if (x.failures !== undefined) ret.failures = defaultConstructor(x.failures) as unknown as ValidationFailure[];

  return ret;
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

  let success = true;

  if (test.valid !== undefined) {
    if (test.valid !== valid) success = false;
  }

  if (test.failures !== undefined) {
    success = success && deepEquals(failures, test.failures);
  }

  if (!success) logger.log(test, failures);
  return { success };
}

export function runValidationTests(testNames: string[]) {
  for (const { name, text } of loadTestFiles('test/validation', testNames)) {
    logger.log(name);
    logger.indented(() => {
      for (const document of loadStream(text)) {
        const validationTest = constructValidationTest(document);

        const result = runValidationTest(validationTest);

        logger.log(result);
      }
    });
    logger.log();
  }
}
