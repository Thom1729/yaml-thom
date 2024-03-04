import {
  NodeComparator,
  type RepresentationNode,
  type RepresentationScalar,
  type RepresentationSequence,
  type RepresentationMapping,
  type PathEntry,
} from '@/nodes';

import {
  NestedMap, assertNotUndefined, isNotUndefined, enumerate,
} from '@/util';

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
  return new ValidationProvider().validateNode(validator, node, []);
}

export interface ValidationFailure {
  path: PathEntry[];
  key: keyof Validator;
  children?: ValidationFailure[];
}

export class ValidationProvider {
  readonly validatorsById = new Map<string, Validator>();
  readonly cache = new NestedMap<[Validator, RepresentationNode], ValidationFailure[]>(
    () => new WeakMap(),
    () => new WeakMap(),
  );
  readonly comparator = new NodeComparator(); // TODO accept as arg

  *[Symbol.iterator]() {
    yield* this.validatorsById.entries();
  }

  add(...items: (Validator | ValidationProvider)[]) {
    for (const item of items) {
      if (item instanceof ValidationProvider) {
        for (const [id, v] of item) {
          this.defineValidatorForId(id, v);
        }
      } else {
        for (const validator of iterateValidators(item)) {
          if (validator.id !== undefined) {
            this.defineValidatorForId(validator.id, validator);
          }
        }
      }
    }
  }

  defineValidatorForId(id: string, validator: Validator) {
    if (this.validatorsById.has(id)) {
      throw new Error(`Duplicate validator ${id}`);
    }
    this.validatorsById.set(id, validator);
  }

  getValidatorById(id: string) {
    return this.validatorsById.get(id);
  }

  validate(validator: Validator, node: RepresentationNode) {
    return this.validateNode(validator, node, []);
  }

  isValid(validator: Validator, node: RepresentationNode) {
    return this.validate(validator, node).length === 0;
  }

  assertValid(validator: Validator, node: RepresentationNode) {
    const failures = this.validate(validator, node);
    if (failures.length !== 0) {
      throw new ValidationError(failures[0]);
    }
  }

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
  ): Iterable<ValidationFailure> {
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

    if (validator.ref) {
      const child = this.getValidatorById(validator.ref);
      assertNotUndefined(child, `No validator defined for ref ${JSON.stringify(validator.ref)}`);
      yield* this.validateNode(child, node, path);
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
  ): Iterable<ValidationFailure> {
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
  ): Iterable<ValidationFailure> {
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
  ): Iterable<ValidationFailure> {
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

function* iterateValidators(root: Validator) {
  const seen = new Set<Validator>();

  function* recurse(validator: Validator): Iterable<Validator> {
    if (seen.has(validator)) return;

    seen.add(validator);
    yield validator;

    const children = [
      ...(validator.anyOf ?? []),
      validator.items,
      ...(validator.properties?.values() ?? []),
      validator.additionalProperties,
    ].filter(isNotUndefined);

    for (const child of children) {
      if (child !== undefined) yield* recurse(child);
    }
  }

  yield* recurse(root);
}
