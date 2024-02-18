import { RepresentationNode } from '@/nodes';
import type { Validator } from '@/validator';

import {
  type Type, type TypeInfo,
  name, union, tuple, builtin, readonly, string,
} from './typeAst';

export function validatorToType(validator: Validator) {
  const operation = new ValidatorToTypeOperation();
  operation.recurse(validator);
  return operation.map;
}

class ValidatorToTypeOperation {
  readonly map = new Map<Validator, TypeInfo>();

  recurse(validator: Validator): Type {
    let ref = this.map.get(validator);
    if (ref !== undefined) {
      ref.refCount++;
    } else {
      ref = {
        refCount: 1,
        value: undefined,
      };
      if (validator.name !== undefined) {
        ref.name = validator.name;
      }
      this.map.set(validator, ref);
      ref.value = this.validatorToType(validator);
    }
    return { kind: 'ref', ref };
  }

  validatorToType(validator: Validator): Type {
    if (validator.enum !== undefined) {
      return union(...Array.from(validator.enum).map(value => this.nodeToType(value)));
    }

    if (validator.anyOf !== undefined) {
      return union(...validator.anyOf.map(v => this.recurse(v)));
    }

    const tag: Type = validator.tag
      ? union(...Array.from(validator.tag).map(string))
      : builtin.string;

    const byKind: Type[] = [];

    if (validator.kind?.has('scalar') ?? true) {
      byKind.push(name('RepresentationScalar', tag, this.scalarContent(validator)));
    }

    if (validator.kind?.has('sequence') ?? true) {
      byKind.push(name('RepresentationSequence', tag, this.sequenceContent(validator)));
    }

    if (validator.kind?.has('mapping') ?? true) {
      byKind.push(name('RepresentationMapping', tag, this.mappingContent(validator)));
    }

    return union(...byKind);
  }

  scalarContent(validator: Validator): Type | undefined {
    return undefined;
  }

  sequenceContent(validator: Validator): Type | undefined {
    const itemType = validator.items !== undefined
      ? this.recurse(validator.items)
      : undefined;

    return itemType;
  }

  mappingContent(validator: Validator): Type {
    const pairs: Type[] = [];

    if (validator.properties !== undefined) {
      for (const [key, value] of validator.properties) {
        pairs.push(readonly(tuple(
          this.nodeToType(key),
          this.recurse(value),
        )));
      }
    }

    if (validator.additionalProperties !== undefined) {
      pairs.push(readonly(tuple(
        name('RepresentationNode'),
        this.recurse(validator.additionalProperties),
      )));
    }

    return union(...pairs);
  }

  nodeToType(node: RepresentationNode): Type {
    if (node.kind === 'scalar') {
      return name('RepresentationScalar', string(node.tag), string(node.content));
    } else {
      throw new Error('not implemented');
    }
  }
}
