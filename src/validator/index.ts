import {
  NodeComparator,
  type RepresentationNode,
} from '@/nodes';
import { WeakCache, strictKeys } from '@/util';

export interface Validator {
  kind?: 'scalar' | 'sequence' | 'mapping';
  tag?: string;

  const?: RepresentationNode;

  minLength?: bigint;
}

export function validate(
  validator: Validator,
  node: RepresentationNode,
): boolean {
  const itr = new NodeValidator().validate(validator, node);
  const { done } = itr.next();
  return done ?? false;
}

type PathEntry =
| { type: 'index', index: number }
| { type: 'key', key: RepresentationNode }
| { type: 'value', key: RepresentationNode };

export interface ValidationFailure {
  // path: PathEntry[];
  validator: Validator;
  key: keyof Validator;
}

const VALIDATORS = {
  kind: (node, kind) => node.kind === kind,
  tag: (node, tag) => node.tag === tag,

  const: function (node, value) {
    return this.comparator.compare(value, node) === 0;
  },

  minLength: (node, minLength) => node.size >= minLength,
} satisfies {
  [K in keyof Validator]: (
    this: NodeValidator,
    node: RepresentationNode,
    value: Exclude<Validator[K], undefined>,
  ) => boolean | Generator<ValidationFailure, boolean>
};

const VALIDATOR_KEYS = strictKeys(VALIDATORS);

class NodeValidator {
  readonly cache = new WeakCache<[Validator, RepresentationNode], boolean | null>();
  readonly comparator = new NodeComparator();

  *validate(validator: Validator, node: RepresentationNode): Generator<ValidationFailure, boolean> {
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
        ) => boolean | Generator<ValidationFailure, boolean>;

        const result = f.call(this, node, validator[key]);
        const valid = typeof result === 'boolean' ? result : yield* result;

        if (!valid) {
          this.cache.set(validator, node, false);
          yield { validator, key: key };
          return false;
        }
      }
    }

    this.cache.set(validator, node, true);
    return true;
  }
}
