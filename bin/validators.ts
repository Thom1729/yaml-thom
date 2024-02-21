import fs from 'fs/promises';
import path from 'path';

import {
  loadStream,
  ValidationProvider, validateValidator, constructValidator,
} from '@';

import { BASE_PATH } from './helpers';

const VALIDATORS_PATH = path.join(BASE_PATH, 'validators');

export const validationProvider = new ValidationProvider();

const validatorNames = (await fs.readdir(VALIDATORS_PATH)).filter(name => name.endsWith('.yaml'));

for (const validatorName of validatorNames) {
  const text = await fs.readFile(path.join(VALIDATORS_PATH, validatorName), { encoding: 'utf-8' });
  for (const doc of loadStream(text)) {
    validateValidator(doc);
    const validator = constructValidator(doc);
    validationProvider.add(validator);
  }
}
