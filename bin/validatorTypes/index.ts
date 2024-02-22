import {
  command,
  readText,
} from '../helpers';

import {
  loadStream,
  validateValidator, constructValidator,
  ValidationProvider, type Validator
} from '@';

import { ValidatorToTypeOperation } from './validatorToType';
import { printTypes } from './printTypes';

export const validatorTypes = command<{
  filename: readonly string[],
}>(async ({ filename: filenames }) => {
  const provider = new ValidationProvider();
  const validators: Validator[] = [];

  for (const filename of filenames) {
    try {
      const text = await readText(filename);
      for (const doc of loadStream(text)) {
        validateValidator(doc);
        const validator = constructValidator(doc);
        provider.add(validator);
        validators.push(validator);
      }
    } catch (e) {
      throw new Error(`Failed to load validator ${filename}`, { cause: e });
    }
  }

  const op = new ValidatorToTypeOperation(provider.getValidatorById.bind(provider));

  for (const validator of validators) {
    op.recurse(validator);
  }

  for (const token of printTypes(op.map)) {
    process.stdout.write(token);
  }
});
