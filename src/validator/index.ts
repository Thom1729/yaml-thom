import {
  NodeComparator,
  type RepresentationNode,
} from '@/nodes';
import { WeakCache, strictKeys } from '@/util';

export interface Validator {
  kind?: 'scalar' | 'sequence' | 'mapping';
  tag?: string;

  const?: RepresentationNode;

  minLength?: number;
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

const SIMPLE_VALIDATORS = {
  kind: (node, kind) => (node.kind === kind),
  tag: (node, tag) => (node.tag === tag),
} satisfies {
  [K in keyof Validator]: (
    node: RepresentationNode,
    value: Exclude<Validator[K], undefined>,
  ) => boolean
};

const SIMPLE_VALIDATOR_KEYS = strictKeys(SIMPLE_VALIDATORS);

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

    for (const key of SIMPLE_VALIDATOR_KEYS) {
      if (validator[key] !== undefined) {
        const result = SIMPLE_VALIDATORS[key](node, validator[key] as any);
        if (!result) {
          this.cache.set(validator, node, false);
          yield { validator, key: key };
        }
      }
    }

    if (validator.const !== undefined) {
      if (this.comparator.compare(validator.const, node) !== 0) {
        this.cache.set(validator, node, false);
        yield { validator, key: 'const' };
        return false;
      }
    }

    if (validator.minLength !== undefined && node.kind === 'scalar') {
      if (node.size < validator.minLength) {
        this.cache.set(validator, node, false);
        yield { validator, key: 'minLength' };
        return false;
      }
    }

    this.cache.set(validator, node, true);
    return true;
  }
}
