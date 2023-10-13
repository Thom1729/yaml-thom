import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import {
  loadSingleDocument,
  extractStringMap,
  defaultConstructor,
  validate, type Validator,
} from '../lib';

const BASE_TEST_PATH = path.join(
  fileURLToPath(import.meta.url),
  '../../test/validation',
);

export function runValidationTests(testNames: string[]) {
  for (const testName of testNames) {
    const filePath = path.join(BASE_TEST_PATH, testName + '.yaml');
    const text = fs.readFileSync(filePath, { encoding: 'utf-8' });

    const test = loadSingleDocument(text);

    const { validator: rawValidator, input } = extractStringMap(test, ['validator', 'input']);

    const validator = defaultConstructor(rawValidator);

    const valid = validate(validator as Validator, input);

    console.log(valid ? 'success' : 'failure');
  }
}
