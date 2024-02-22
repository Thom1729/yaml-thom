import type { RepresentationNode } from '@/nodes';
import { constructValidator } from './constructValidator';
import { ValidationProvider } from './validate';
import { loadStream } from '@/loadDump';

import type { Validator as RawValidator } from '@validators';

import validator from '../../validators/validator.yaml';
import annotation from '../../validators/annotation.yaml';

const VALIDATOR_TEXTS = [
  validator,
  annotation,
];

export const builtinValidationProvider = new ValidationProvider();

for (const text of VALIDATOR_TEXTS) {
  for (const doc of loadStream(text)) {
    const validator = constructValidator(doc as RawValidator);
    builtinValidationProvider.add(validator);
  }
}

export function validateValidator(
  node: RepresentationNode,
): asserts node is RawValidator {
  builtinValidationProvider.validate(builtinValidationProvider.getValidatorById('#validator'), node);
}
