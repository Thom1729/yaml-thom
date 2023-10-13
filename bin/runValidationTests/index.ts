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
  input: RepresentationNode
}

interface ValidationTestResult {
  valid: boolean;
}

function loadValidationTest(document: RepresentationNode): ValidationTest {
  const { validator: rawValidator, input } = extractStringMap(document, ['validator', 'input']);

  const validator = defaultConstructor(rawValidator) as Validator;

  return {
    validator,
    input,
  };
}

function runValidationTest(test: ValidationTest): ValidationTestResult {
  const valid = validate(test.validator, test.input);
  return { valid };
}

export function runValidationTests(testNames: string[]) {
  for (const text of loadTestFiles('test/validation', testNames)) {
    for (const document of loadStream(text)) {
      const validationTest = loadValidationTest(document);

      const result = runValidationTest(validationTest);

      console.log(result);
    }
  }
}
