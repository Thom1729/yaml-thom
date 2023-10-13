import { loadTestFiles } from 'bin/helpers';

import {
  loadStream,
  extractStringMap,
  defaultConstructor,
  validate, type Validator,
  type RepresentationNode,
} from '../lib';

interface ValidationTest {
  validator: Validator;
  input: RepresentationNode;
  valid?: boolean;
}

interface ValidationTestResult {
  success: boolean;
}

function constructValidationTest(document: RepresentationNode): ValidationTest {
  const { validator: rawValidator, input, valid: rawValid } = extractStringMap(document, ['validator', 'input', 'valid?']);

  const validator = defaultConstructor(rawValidator) as Validator;
  const valid = rawValid && defaultConstructor(rawValid) as boolean;

  return {
    validator,
    input,
    valid,
  };
}

function runValidationTest(test: ValidationTest): ValidationTestResult {
  const valid = validate(test.validator, test.input);
  const success = valid === test.valid;

  if (!success) console.error(valid, test.valid, test);
  return { success };
}

export function runValidationTests(testNames: string[]) {
  for (const text of loadTestFiles('test/validation', testNames)) {
    for (const document of loadStream(text)) {
      const validationTest = constructValidationTest(document);

      const result = runValidationTest(validationTest);

      console.log(result);
    }
  }
}
