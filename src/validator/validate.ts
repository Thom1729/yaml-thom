import {
  NodeComparator,
  type RepresentationNode,
  type RepresentationScalar,
  type RepresentationSequence,
  type RepresentationMapping,
  type PathEntry,
} from '@/nodes';

import { NestedMap, enumerate } from '@/util';

import type { Validator, Validated } from './types';

export function isValid<ValidatorType extends Validator>(
  validator: ValidatorType,
  node: RepresentationNode,
): node is Validated<ValidatorType> {
  return validate(validator, node).length === 0;
}

export class ValidationError extends Error {
  failure: ValidationFailure;

  constructor(failure: ValidationFailure) {
    super(failure.key);
    Object.setPrototypeOf(this, ValidationError.prototype);
    this.failure = failure;
  }
}

export function assertValid<ValidatorType extends Validator>(
  validator: ValidatorType,
  node: RepresentationNode,
): asserts node is Validated<ValidatorType> {
  const failures = validate(validator, node);
  if (failures.length !== 0) {
    throw new ValidationError(failures[0]);
  }
}

export function validate(
  validator: Validator,
  node: RepresentationNode,
) {
  return new NodeValidator().validateNode(validator, node, []);
}

export interface ValidationFailure {
  path: PathEntry[];
  key: keyof Validator;
  children?: ValidationFailure[];
}

class NodeValidator {
  readonly cache = new NestedMap<[Validator, RepresentationNode], ValidationFailure[]>(
    () => new WeakMap(),
    () => new WeakMap(),
  );
  readonly comparator = new NodeComparator();

  validateNode(
    validator: Validator,
    node: RepresentationNode,
    path: PathEntry[],
  ) {
    let failures = this.cache.get(validator, node);
    if (failures === undefined) {
      failures = [];
      this.cache.set(validator, node, failures);
      for (const item of this._validateNode(validator, node, path)) {
        failures.push(item);
      }
    }
    return failures;
  }

  *_validateNode(
    validator: Validator,
    node: RepresentationNode,
    path: PathEntry[],
  ): Generator<ValidationFailure> {
    if (validator.kind !== undefined) {
      if (!validator.kind.has(node.kind)) {
        yield { path, key: 'kind' };
      }
    }

    if (validator.tag !== undefined) {
      if (!validator.tag.has(node.tag)) {
        yield { path, key: 'tag' };
      }
    }

    if (validator.enum !== undefined) {
      if (!validator.enum.has(node, this.comparator)) {
        yield { path, key: 'enum' };
      }
    }

    if (node.kind === 'scalar') {
      yield* this.validateScalar(validator, node, path);
    } else if (node.kind === 'sequence') {
      yield* this.validateSequence(validator, node, path);
    } else if (node.kind === 'mapping') {
      yield* this.validateMapping(validator, node, path);
    }

    if (validator.anyOf !== undefined) {
      // TODO: child failures
      let anySuccess = false;
      for (const alternative of validator.anyOf) {
        const failures = this.validateNode(alternative, node, path);
        if (failures.length === 0) {
          anySuccess = true;
          break;
        }
      }
      if (!anySuccess) {
        yield { path, key: 'anyOf' };
      }
    }
  }

  *validateScalar(
    validator: Validator,
    node: RepresentationScalar,
    path: PathEntry[],
  ): Generator<ValidationFailure> {
    if (validator.minLength !== undefined) {
      if (node.size < validator.minLength) {
        yield { path, key: 'minLength' };
      }
    }
  }

  *validateSequence(
    validator: Validator,
    node: RepresentationSequence,
    path: PathEntry[],
  ): Generator<ValidationFailure> {
    if (validator.items !== undefined) {
      for (const [index, item] of enumerate(node)) {
        const itemFailures = this.validateNode(validator.items, item, [...path, { type: 'index', index }]);
        if (itemFailures.length > 0) {
          yield { path, key: 'items', children: itemFailures };
        }
      }
    }
  }

  *validateMapping(
    validator: Validator,
    node: RepresentationMapping,
    path: PathEntry[],
  ): Generator<ValidationFailure> {
    if (validator.properties !== undefined || validator.additionalProperties !== undefined) {
      for (const [key, value] of node) {
        const propertyValidator = validator.properties?.get(key) ?? validator.additionalProperties;
        if (propertyValidator === undefined) {
          yield {
            path: [...path, { type: 'key', key }],
            key: 'properties',
          };
        } else {
          const childFailures = this.validateNode(propertyValidator, value, [...path, { type: 'value', key }]);
          if (childFailures.length > 0) {
            yield { path, key: 'properties', children: childFailures };
          }
        }
      }
    }

    if (validator.requiredProperties !== undefined) {
      for (const key of validator.requiredProperties) {
        if (!node.has(key)) {
          yield { path, key: 'requiredProperties' };
        }
      }
    }
  }
}
