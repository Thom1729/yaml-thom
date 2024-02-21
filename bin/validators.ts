import fs from 'fs';
import path from 'path';

import {
  loadSingleDocument,
  ValidationProvider, validateValidator, constructValidator,
} from '@';

import { BASE_PATH } from './helpers';

const VALIDATORS_PATH = path.join(BASE_PATH, 'validators');

export const validationProvider = new ValidationProvider();

const validatorNames = fs.readdirSync(VALIDATORS_PATH).filter(name => name.endsWith('.yaml'));

for (const validatorName of validatorNames) {
  const text = fs.readFileSync(path.join(VALIDATORS_PATH, validatorName), { encoding: 'utf-8' });
  const doc = loadSingleDocument(text);
  validateValidator(doc);
  const validator = constructValidator(doc);
  validationProvider.add(validator);
}
