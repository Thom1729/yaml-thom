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
  const itr = validate(validator, node);
  const { done } = itr.next();
  return done ?? false;
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
  const itr = validate(validator, node);
  const result = itr.next();
  if (!result.done) {
    throw new ValidationError(result.value);
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

  *validateNode(
    validator: Validator,
    node: RepresentationNode,
    path: PathEntry[],
  ): Generator<ValidationFailure> {
    const cached = this.cache.get(validator, node);
    if (cached !== undefined) {
      return;
    }

    const failures: ValidationFailure[] = [];
    this.cache.set(validator, node, failures);

    if (validator.kind !== undefined) {
      if (!validator.kind.has(node.kind)) {
        const failure: ValidationFailure = { path, key: 'kind' };
        failures.push(failure);
        yield failure;
      }
    }

    if (validator.tag !== undefined) {
      if (!validator.tag.has(node.tag)) {
        const failure: ValidationFailure = { path, key: 'tag' };
        failures.push(failure);
        yield failure;
      }
    }

    if (validator.enum !== undefined) {
      if (!validator.enum.has(node, this.comparator)) {
        const failure: ValidationFailure = { path, key: 'enum' };
        failures.push(failure);
        yield failure;
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
        const failures = Array.from(this.validateNode(alternative, node, path));
        if (failures.length === 0) {
          anySuccess = true;
          break;
        }
      }
      if (!anySuccess) {
        const failure: ValidationFailure = { path, key: 'anyOf' };
        failures.push(failure);
        yield failure;
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
        for (const failure of this.validateNode(validator.items, item, [...path, { type: 'index', index }])) {
          yield failure;
        }
      }
    }
  }

  *validateMapping(
    validator: Validator,
    node: RepresentationMapping,
    path: PathEntry[],
  ): Generator<ValidationFailure> {
    if (validator.properties !== undefined) {
      let valid = true;
      if (node.kind === 'mapping') {
        for (const [key, value] of node) {
          const propertyValidator = validator.properties.get(key);
          if (propertyValidator === undefined) {
            valid = false;
            yield {
              path: [...path, { type: 'key', key }],
              key: 'properties',
            };
          } else {
            for (const failure of this.validateNode(propertyValidator, value, [...path, { type: 'value', key }])) {
              valid = false;
              yield failure;
            }
          }
        }
      }
      return valid;
    }

    if (validator.requiredProperties !== undefined) {
      let valid = true;
      if (node.kind === 'mapping') {
        for (const key of validator.requiredProperties) {
          if (!node.has(key)) {
            valid = false;
            yield { path, key: 'requiredProperties' };
          }
        }
      }
      return valid;
    }
  }
}
