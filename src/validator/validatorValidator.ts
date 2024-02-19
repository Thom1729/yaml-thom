import type { Validator as ValidatedValidator } from './generated';
import { loadSingleDocument } from '..';

import validatorText from '../../validators/validator.yaml';

export const validatorValidator = loadSingleDocument(validatorText) as ValidatedValidator;
