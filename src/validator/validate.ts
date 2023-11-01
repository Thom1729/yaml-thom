import {
  NodeComparator,
  type RepresentationNode,
} from '@/nodes';

import { WeakCache, strictKeys, enumerate, isArray } from '@/util';

import type { Validator } from '.';
import { OneOrMore } from './types';

export function isValid(
  validator: Validator,
  node: RepresentationNode,
): boolean {
  const itr = validate(validator, node);
  const { done } = itr.next();
  return done ?? false;
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
    // value: Validator[Key];
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
    return this.comparator.compare(value, node) === 0;
  },

  enum: function (node, items) {
    return items.some(value => this.comparator.compare(value, node) === 0);
  },

  minLength: (node, minLength) => node.size >= minLength,

  items: function *(node, validator, path) {
    if (node.kind === 'sequence') {
      for (const [index, item] of enumerate(node)) {
        yield* this.validate(validator, item, [...path, { type: 'index', index }]);
      }
    }

    return true;
  },

  properties: function *(node, validators, path) {
    if (node.kind === 'mapping') {
      for (const [key, value] of node) {
        const pair = validators.find(([k,]) => this.comparator.compare(k, key) === 0);
        if (pair === undefined) {
          yield {
            path: [...path, { type: 'key', key }],
            key: 'properties',
          };
        } else {
          const validator = pair[1];
          yield* this.validate(validator, value, [...path, { type: 'value', key }]);
        }
      }
    }
    return true;
  },
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
  readonly cache = new WeakCache<[Validator, RepresentationNode], boolean | null>();
  readonly comparator = new NodeComparator();

  *validate(
    validator: Validator,
    node: RepresentationNode,
    path: PathEntry[],
  ): Generator<ValidationFailure, boolean> {
    const cached = this.cache.get(validator, node);
    if (cached === true || cached === null) {
      return true;
    } else if (cached === false) {
      return false;
    } else {
      this.cache.set(validator, node, null);
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
        const valid = typeof result === 'boolean' ? result : yield* result;

        if (!valid) {
          this.cache.set(validator, node, false);
          yield { path, key } as ValidationFailure;
          return false;
        }
      }
    }

    this.cache.set(validator, node, true);
    return true;
  }
}
