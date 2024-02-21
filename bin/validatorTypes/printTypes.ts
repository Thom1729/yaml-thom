import type { Validator } from '@/validator';
import { stringifyTokens, type Tokens } from '@/util';

import type { Type, TypeInfo } from './typeAst';

// TODO make dynamic
const PREAMBLE = `
import type {
  RepresentationNode,
  RepresentationScalar,
  RepresentationSequence,
  RepresentationMapping,
} from '@/index';
`.trimStart();

export function printTypes(types: Map<Validator, TypeInfo>): Generator<string> {
  return stringifyTokens(
    new PrintTypesOperation(types).printAll(),
    '  ',
  );
}

class PrintTypesOperation {
  private readonly types: Map<Validator, TypeInfo>;
  private readonly queue: Required<TypeInfo>[] = [];
  private readonly done: Set<TypeInfo> = new Set();
  private index = 1;

  constructor(types: Map<Validator, TypeInfo>) {
    this.types = types;
  }

  enqueue(t: TypeInfo): asserts t is Required<TypeInfo> {
    if (this.done.has(t)) return;

    if (t.name === undefined) {
      t.name = `T${this.index++}`;
    }
    this.done.add(t);
    this.queue.push(t as Required<TypeInfo>);
  }

  *printAll(): Tokens {
    yield PREAMBLE;

    for (const type of this.types.values()) {
      if (type.name !== undefined) this.enqueue(type);
    }

    while (true) {
      const t = this.queue.shift();
      if (t === undefined) break;
      yield '\n';
      yield `export type ${t.name} =`;
      yield null;
      yield* this.printTypeInfo(t.value, 0);
      yield `;\n`;
    }
  }

  *printTypeInfo(value: Type, level: number): Tokens {
    const compact = depth(value) <= 1;
    if (value.kind === 'ref') {
      const ref = value.ref;
      if (ref.refCount > 1) {
        this.enqueue(ref);
        yield ref.name;
      } else {
        yield* this.printTypeInfo(ref.value as Type, level);
      }
    } else if (value.kind === 'name') {
      yield value.name;
      if (value.children.length > 0) {
        yield '<';
        yield* this.printList(value.children, level, compact);
        yield '>';
      }
    } else if (value.kind === 'string') {
      yield '\'' + JSON.stringify(value.value).slice(1, -1) + '\'';
    } else if (value.kind === 'union') {
      yield* this.printLattice('|', value.children, level, compact);
    } else if (value.kind === 'tuple') {
      yield '[';
      yield* this.printList(value.children, level, compact);
      yield ']';
    } else if (value.kind === 'readonly') {
      yield 'readonly ';
      yield* this.printTypeInfo(value.child, level);
    } else {
      throw new TypeError(`Unhandled kind ${(value as Type).kind}`);
    }
  }

  *printLattice(operator: string, types: readonly Type[], level: number, compact: boolean): Tokens {
    if (types.length === 0) throw new TypeError(`empty union or intersection`);

    if (compact) {
      let first = true;
      for (const item of types) {
        if (first) {
          first = false;
        } else {
          yield ` ${operator} `;
        }
        yield* this.printTypeInfo(item, level + 1);
      }
    } else {
      let first = true;
      for (const member of types) {
        if (first) {
          first = false;
        } else {
          yield '\n';
          yield level;
        }
        yield `${operator} `;
        yield* this.printTypeInfo(member, level + 1);
      }
    }
  }

  *printList(types: readonly Type[], level: number, compact: boolean): Tokens {
    if (types.length === 0) return;

    let first = true;
    if (compact) {
      for (const item of types) {
        if (first) {
          first = false;
        } else {
          yield ', ';
        }
        yield* this.printTypeInfo(item, level + 1);
      }
    } else {
      for (const item of types) {
        if (first) {
          first = false;
        } else {
          yield ',';
        }
        yield '\n';
        yield level + 1;
        yield* this.printTypeInfo(item, level + 1);
      }
      yield '\n';
      yield level;
    }
  }
}

function depth(type: Type): number {
  switch (type.kind) {
    case 'ref': case 'string': return 0;
    case 'name': case 'union': case 'tuple': {
      return Math.max(...type.children.map(depth)) + 1;
    }
    case 'readonly': case 'parenthesized': {
      return depth(type.child);
    }
    default: throw new Error(`unhandled kind ${(type as Type).kind}`);
  }
}
