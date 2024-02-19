import type { RepresentationNode } from '@/nodes';
import { loadSingleDocument } from '@/loadDump';

import type { Validator as ValidatedValidator } from './generated';
import { constructValidator } from './constructValidator';
import { assertValid } from './validate';

import validatorText from '../../validators/validator.yaml';

// We can't validate the validator validator against itself until it's constructed
const rawValidatorValidator = loadSingleDocument(validatorText) as ValidatedValidator;
const validatorValidator = constructValidator(rawValidatorValidator);
validateValidator(rawValidatorValidator);

export function validateValidator(
  validator: RepresentationNode,
): asserts validator is ValidatedValidator {
  assertValid(validatorValidator, validator);
}
