import fs from 'fs/promises';
import path from 'path';

import {
  ValidationProvider, validateValidator, constructValidator,
} from '@';

import { builtinValidationProvider } from '@/validator/validatorValidator';

import { BASE_PATH } from './basePath';
import { readStream } from './helpers';

const VALIDATORS_PATH = path.join(BASE_PATH, 'bin', 'testValidators');

export const validationProvider = new ValidationProvider();
validationProvider.add(builtinValidationProvider);

const validatorNames = (await fs.readdir(VALIDATORS_PATH)).filter(name => name.endsWith('.yaml'));

for (const validatorName of validatorNames) {
  for await (const { document } of readStream([VALIDATORS_PATH, validatorName])) {
    validateValidator(document);
    const validator = constructValidator(document);
    validationProvider.add(validator);
  }
}
