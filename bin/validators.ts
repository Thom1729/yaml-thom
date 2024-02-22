import fs from 'fs/promises';
import path from 'path';

import {
  ValidationProvider, validateValidator, constructValidator,
} from '@';

import { BASE_PATH, readStream } from './helpers';

const VALIDATORS_PATH = path.join(BASE_PATH, 'validators');

export const validationProvider = new ValidationProvider();

const validatorNames = (await fs.readdir(VALIDATORS_PATH)).filter(name => name.endsWith('.yaml'));

for (const validatorName of validatorNames) {
  for await (const doc of readStream([VALIDATORS_PATH, validatorName])) {
    validateValidator(doc);
    const validator = constructValidator(doc);
    validationProvider.add(validator);
  }
}
