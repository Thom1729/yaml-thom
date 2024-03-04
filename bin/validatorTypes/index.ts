import {
  command,
  readText, writeText,
} from '../helpers';

import {
  loadStream,
  validateValidator, constructValidator,
  ValidationProvider, type Validator
} from '@';

import { ValidatorToTypeOperation } from './validatorToType';
import { printTypes } from './printTypes';
import { assertNotUndefined } from '@/util';

export const validatorTypes = command<{
  filename: readonly string[],
  out?: string,
}>(async ({ filename: filenames, out: outputFile }) => {
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

  const op = new ValidatorToTypeOperation(id => {
    const validator = provider.getValidatorById(id);
    assertNotUndefined(validator);
    return validator;
  });

  for (const validator of validators) {
    op.recurse(validator);
  }

  const output = Array.from(printTypes(op.map)).join('');

  if (outputFile !== undefined) {
    await writeText(outputFile, output);
  } else {
    process.stdout.write(output);
  }
});
