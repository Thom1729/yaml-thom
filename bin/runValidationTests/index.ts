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

  const validator = constructValidator(rawValidator);
  const valid = rawValid && defaultConstructor(rawValid) as boolean;

  return {
    validator,
    input,
    valid,
  };
}

function constructValidator(node: RepresentationNode): Validator {
  const x = extractStringMap(node, ['kind?', 'tag?', 'const?', 'minLength?']);

  const ret: Validator = {};

  if (x.kind !== undefined) {
    const kind = defaultConstructor(x.kind);
    if (kind !== 'scalar' && kind !== 'sequence' && kind !== 'mapping') throw new TypeError();
    ret.kind = kind;
  }

  if (x.tag !== undefined) {
    const tag = defaultConstructor(x.tag);
    if (typeof tag !== 'string') throw new TypeError();
    ret.tag = tag;
  }

  if (x.const !== undefined) {
    ret.const = x.const;
  }

  if (x.minLength !== undefined) {
    const minLength = defaultConstructor(x.minLength);
    if (typeof minLength !== 'bigint') throw new TypeError();
    ret.minLength = minLength;
  }

  return ret;
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
