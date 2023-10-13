import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import {
  loadSingleDocument,
  extractStringMap,
  defaultConstructor,
  validate, type Validator,
  type RepresentationNode,
} from '../lib';

const BASE_TEST_PATH = path.join(
  fileURLToPath(import.meta.url),
  '../../test/validation',
);

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
  if (testNames.length === 0) {
    testNames = fs.readdirSync(BASE_TEST_PATH);
  }

  for (const testName of testNames) {
    const filePath = path.join(BASE_TEST_PATH, testName.endsWith('.yaml') ? testName : testName + '.yaml');
    const text = fs.readFileSync(filePath, { encoding: 'utf-8' });

    const test = loadSingleDocument(text);

    const validationTest = loadValidationTest(test);

    const result = runValidationTest(validationTest);

    console.log(result);
  }
}
