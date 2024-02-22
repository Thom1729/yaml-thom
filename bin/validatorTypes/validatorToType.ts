import { RepresentationNode } from '@/nodes';
import type { Validator } from '@/validator';

import {
  type Type, type TypeInfo,
  name, union, intersection, tuple, builtin, readonly, string,
} from './typeAst';

import { capitalize } from '@/util';

export class ValidatorToTypeOperation {
  readonly getValidatorById: (id: string) => Validator;
  readonly map = new Map<Validator, TypeInfo>();
  readonly imports = new Set<string>;

  constructor(getValidatorById: (id: string) => Validator) {
    this.getValidatorById = getValidatorById;
  }

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
    const children = Array.from(this._validatorToType(validator));
    if (children.length > 0) {
      return intersection(...children);
    } else {
      return name('RepresentationNode');
    }
  }

  *_validatorToType(validator: Validator): Iterable<Type> {
    if (validator.ref !== undefined) {
      yield this.recurse(this.getValidatorById(validator.ref));
    }

    if (validator.enum !== undefined) {
      yield union(...Array.from(validator.enum).map(value => this.nodeToType(value)));
    }

    if (validator.anyOf !== undefined) {
      yield union(...validator.anyOf.map(v => this.recurse(v)));
    }

    const tag = validator.tag
      ? union(...Array.from(validator.tag).map(string))
      : undefined;

    const byKind = ([
      ['scalar', this.scalarContent(validator)],
      ['sequence', this.sequenceContent(validator)],
      ['mapping', this.mappingContent(validator)],
    ] as const).filter(([kind]) => validator.kind?.has(kind) ?? true);

    if (byKind.length === 3 && byKind.every(([, content]) => content.every(t => t === undefined))) {
      if (tag !== undefined) {
        yield this.nodeClass('node', tag);
      }
    } else {
      yield union(...byKind.map(([kind, content]) => {
        return this.nodeClass(kind, tag, ...content);
      }));
    }
  }

  nodeClass(
    kind: string,
    tag: Type | undefined,
    content: Type | undefined = undefined,
    requiredProperties: Type | undefined = undefined,
  ) {
    const className = `Representation${capitalize(kind)}`;
    this.imports.add(className);
    if (requiredProperties !== undefined) {
      return name(className, tag ?? builtin.string, content ?? readonly(tuple(name('RepresentationNode'), name('RepresentationNode'))), requiredProperties);
    } else if (content !== undefined) {
      return name(className, tag ?? builtin.string, content);
    } else if (tag !== undefined) {
      return name(className, tag);
    } else {
      return name(className);
    }
  }

  scalarContent(validator: Validator): (Type | undefined)[] {
    return [undefined];
  }

  sequenceContent(validator: Validator): (Type | undefined)[] {
    const itemType = validator.items !== undefined
      ? this.recurse(validator.items)
      : undefined;

    return [itemType];
  }

  mappingContent(validator: Validator): (Type | undefined)[] {
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

    let required = undefined;
    if (validator.requiredProperties !== undefined) {
      required = union(
        ...Array.from(validator.requiredProperties).map(key => this.nodeToType(key))
      );
    }

    return [pairs.length > 0 ? union(...pairs) : undefined, required];
  }

  nodeToType(node: RepresentationNode): Type {
    if (node.kind === 'scalar') {
      return name('RepresentationScalar', string(node.tag), string(node.content));
    } else {
      throw new Error('not implemented');
    }
  }
}
