import {
  command,
  readTextSync,
} from '../helpers';

import { loadSingleDocument } from '@/loadDump';
import {
  validateValidator, constructValidator,
  ValidationProvider,
} from '@/validator';

import { ValidatorToTypeOperation } from './validatorToType';
import { printTypes } from './printTypes';

export const validatorTypes = command<{
  filename: readonly string[],
}>(({ filename: filenames }) => {
  const provider = new ValidationProvider();

  const validators = filenames.map(filename => {
    const text = readTextSync(filename);
    const doc = loadSingleDocument(text);
    validateValidator(doc);
    const validator = constructValidator(doc);
    provider.add(validator);
    return validator;
  });

  const op = new ValidatorToTypeOperation(provider.getValidatorById.bind(provider));

  for (const validator of validators) {
    op.recurse(validator);
  }

  for (const token of printTypes(op.map)) {
    process.stdout.write(token);
  }
});
