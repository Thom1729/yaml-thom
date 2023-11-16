import {
  NodeComparator,
  type RepresentationNode,
} from '@/nodes';

import { NestedMap, strictKeys, enumerate, isArray } from '@/util';

import type { Validator } from '.';
import type { OneOrMore, Validated } from './types';

export function isValid<ValidatorType extends Validator>(
  validator: ValidatorType,
  node: RepresentationNode,
): node is Validated<ValidatorType> {
  const itr = validate(validator, node);
  const { done } = itr.next();
  return done ?? false;
}

export function assertValid<ValidatorType extends Validator>(
  validator: ValidatorType,
  node: RepresentationNode,
): asserts node is Validated<ValidatorType> {
  if (!isValid(validator, node)) throw new TypeError('invalid');
}

export function validate(
  validator: Validator,
  node: RepresentationNode,
) {
  return new NodeValidator().validate(validator, node, []);
}

type PathEntry =
| { type: 'index', index: number }
| { type: 'key', key: RepresentationNode }
| { type: 'value', key: RepresentationNode };

export type ValidationFailure<TKey extends keyof Validator = keyof Validator> = {
  [Key in TKey]: {
    path: PathEntry[];
    key: Key;
    children?: ValidationFailure[];
  }
}[TKey];

function isOneOrMore<T>(value: T, values: OneOrMore<T>) {
  if (isArray(values)) {
    return values.includes(value);
  } else {
    return value === values;
  }
}

const VALIDATORS = {
  kind: (node, kind) => isOneOrMore(node.kind, kind),
  tag: (node, tag) => isOneOrMore(node.tag, tag),

  const: function (node, value) {
    return this.comparator.equals(value, node);
  },

  enum: function (node, items) {
    return items.some(value => this.comparator.equals(value, node));
  },

  minLength: (node, minLength) => node.size >= minLength,

  items: function *(node, validator, path) {
    let valid = true;
    if (node.kind === 'sequence') {
      for (const [index, item] of enumerate(node)) {
        // valid = yield* this.validate(validator, item, [...path, { type: 'index', index }]);
        for (const failure of this.validate(validator, item, [...path, { type: 'index', index }])) {
          valid = false;
          yield failure;
        }
      }
    }

    return valid;
  },

  properties: function *(node, validators, path) {
    let valid = true;
    if (node.kind === 'mapping') {
      for (const [key, value] of node) {
        const validator = validators.get(key);
        if (validator === undefined) {
          valid = false;
          yield {
            path: [...path, { type: 'key', key }],
            key: 'properties',
          };
        } else {
          for (const failure of this.validate(validator, value, [...path, { type: 'value', key }])) {
            valid = false;
            yield failure;
          }
        }
      }
    }
    return valid;
  },

  // anyOf: function*(node, validators, path) {
  //   for (const alternative of validators) {
  //     const failures = Array.from(this.validate(alternative, node, path));
  //     if (failures.length === 0) return true;
  //   }
  //   yield* [];
  //   return false;
  // },
} satisfies {
  [K in keyof Validator]: (
    this: NodeValidator,
    node: RepresentationNode,
    value: Exclude<Validator[K], undefined>,
    path: PathEntry[],
  ) => boolean | Generator<ValidationFailure, boolean>
};

const VALIDATOR_KEYS = strictKeys(VALIDATORS);

class NodeValidator {
  readonly cache = new NestedMap<[Validator, RepresentationNode], ValidationFailure[]>(
    () => new WeakMap(),
    () => new WeakMap(),
  );
  readonly comparator = new NodeComparator();

  *validate(
    validator: Validator,
    node: RepresentationNode,
    path: PathEntry[],
  ): Generator<ValidationFailure, undefined, undefined> {
    const cached = this.cache.get(validator, node);
    let failures: ValidationFailure[];
    if (cached !== undefined) {
      return;
    } else {
      failures = [];
      this.cache.set(validator, node, failures);
    }

    for (const key of VALIDATOR_KEYS) {
      if (validator[key] !== undefined) {
        const f = VALIDATORS[key] as (
          this: NodeValidator,
          node: RepresentationNode,
          value: unknown,
          path: PathEntry[],
        ) => boolean | Generator<ValidationFailure, boolean>;

        const result = f.call(this, node, validator[key], path);

        let children: ValidationFailure[] | undefined = undefined;
        let valid: boolean;
        if (typeof result === 'boolean') {
          valid = result;
        } else {
          [children, valid] = collect(result);
          // children = Array.from(result);
          // valid = (children.length === 0);
        }

        if (!valid) {
          const failure: ValidationFailure = { path, key };
          if (children?.length) failure.children = children;
          failures.push(failure);
          yield failure;
          return;
        }
      }
    }
  }
}

function collect<T, R>(
  generator: Generator<T, R>
): [T[], R] {
  const yielded: T[] = [];
  let result = generator.next();
  while (!result.done) {
    yielded.push(result.value);
    result = generator.next();
  }
  return [yielded, result.value];
}
