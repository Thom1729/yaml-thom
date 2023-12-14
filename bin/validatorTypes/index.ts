import {
  command,
  readTextSync,
} from '../helpers';

import { loadSingleDocument } from '@/loadDump';
import { constructValidator } from '@/validator';

import { validatorToType } from './validatorToType';
import { printTypes } from './printTypes';

export const validatorTypes = command<{
  filename: string,
}>(({ filename }) => {
  const text = readTextSync(filename);
  const doc = loadSingleDocument(text);
  const validator = constructValidator(doc);

  const types = validatorToType(validator);

  for (const token of printTypes(types)) {
    process.stdout.write(token);
  }
});
