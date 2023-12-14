import { RepresentationNode } from '@/nodes';
import type { Validator } from '@/validator';

import {
  type Type,
  name, union, tuple, builtin,
} from './typeAst';

export interface TypeInfo {
  name?: string;
  refCount: number;
  value?: Type;
}

//////////

export function validatorToType(validator: Validator) {
  const operation = new ValidatorToTypeOperation();
  operation.recurse(validator);
  return operation.map;
}

class ValidatorToTypeOperation {
  readonly map = new Map<Validator, TypeInfo>();

  recurse(validator: Validator) {
    const done = this.map.get(validator);
    if (done !== undefined) {
      done.refCount++;
    } else {
      const typeInfo: TypeInfo = {
        refCount: 1,
        value: undefined,
      };
      this.map.set(validator, typeInfo);
      typeInfo.value = this.validatorToType(validator);
    }
    return { kind: 'ref', ref: validator } as const;
  }

  validatorToType(validator: Validator): Type {
    if (validator.enum !== undefined) {
      return union(...Array.from(validator.enum).map(value => this.nodeToType(value)));
    }

    if (validator.anyOf !== undefined) {
      return union(...validator.anyOf.map(v => this.recurse(v)));
    }

    const tag: Type = validator.tag
      ? union(...Array.from(validator.tag)
        .map(t => ({ kind: 'string' as const, value: t }))
      )
      : builtin.string;

    return union(
      this.validatorToScalar(validator, tag),
      this.validatorToSequence(validator, tag),
      this.validatorToMapping(validator, tag),
    );
  }

  validatorToScalar(validator: Validator, tag: Type): Type | undefined {
    if (validator.kind !== undefined && !validator.kind?.has('scalar')) return undefined;

    return name('RepresentationScalar', tag, builtin.string);
  }

  validatorToSequence(validator: Validator, tag: Type): Type | undefined {
    if (validator.kind !== undefined && !validator.kind?.has('sequence')) return undefined;

    const itemType = validator.items !== undefined
      ? this.recurse(validator.items)
      : builtin.any;

    return name('RepresentationSequence', tag, itemType);
  }

  validatorToMapping(validator: Validator, tag: Type): Type | undefined {
    if (validator.kind !== undefined && !validator.kind?.has('mapping')) return undefined;

    const pairs: Type[] = [];

    if (validator.properties !== undefined) {
      for (const [key, value] of validator.properties) {
        pairs.push(tuple(
          this.nodeToType(key),
          this.recurse(value),
        ));
      }
    }

    const pairsType = pairs.length ? union(...pairs) : builtin.any;

    return name('RepresentationMapping', tag, pairsType);
  }

  nodeToType(node: RepresentationNode): Type {
    if (node.kind === 'scalar') {
      return name('RepresentationScalar', { kind: 'string', value: node.tag }, { kind: 'string', value: node.content });
    } else {
      throw new Error('not implemented');
    }
  }
}