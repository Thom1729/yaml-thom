import { assertNotUndefined } from '@/util';
import type { Validator } from '@/validator';

import type { Type } from './typeAst';
import type { TypeInfo } from './validatorToType';

const PREAMBLE = `
import type {
  RepresentationNode,
  RepresentationScalar,
  RepresentationSequence,
  RepresentationMapping,
} from '@/index';
`.trimStart();

export function *printTypes(types: Map<Validator, TypeInfo>): Generator<string> {
  for (const token of new PrintTypesOperation(types).printAll()) {
    if (typeof token === 'string') {
      yield token;
    } else if (typeof token === 'number') {
      yield ''.padStart(2 * token, ' ');
    } else {
      console.log(token);
      throw new Error();
    }
  }
}

type Tokens = Generator<string | number>;

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

    this.enqueue(Array.from(this.types.values())[0]);

    while (true) {
      const t = this.queue.shift();
      if (t === undefined) break;
      yield '\n';
      yield `type ${t.name} = `;
      yield* this.printTypeInfo(t.value, 0);
      yield `;\n`;
    }
    yield '\n';
  }

  *printTypeInfo(value: Type, level: number): Tokens {
    const compact = depth(value) <= 1;
    if (value.kind === 'ref') {
      const ref = this.types.get(value.ref);
      assertNotUndefined(ref);
      this.enqueue(ref);
      yield ref.name;
    } else if (value.kind === 'name') {
      yield value.name;
      if (value.children.length > 0) {
        yield '<';
        yield* this.printList(value.children, level, compact);
        yield '>';
      }
    } else if (value.kind === 'string') {
      yield JSON.stringify(value.value);
    } else if (value.kind === 'union') {
      yield '(';
      yield* this.printLattice('|', value.children, level, compact);
      yield ')';
    } else if (value.kind === 'tuple') {
      yield '[';
      yield* this.printList(value.children, level, compact);
      yield ']';
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
      for (const member of types) {
        yield '\n';
        yield level;
        yield `${operator} `;
        yield* this.printTypeInfo(member, level + 1);
      }
      yield '\n';
      yield level;
    }
  }

  *printList(types: readonly Type[], level: number, compact: boolean): Tokens {
    if (compact) {
      let first = true;
      for (const item of types) {
        if (first) {
          first = false;
        } else {
          yield ', ';
        }
        yield* this.printTypeInfo(item, level + 1);
      }
    } else if (types.length > 0) {
      for (const item of types) {
        yield '\n';
        yield level + 1;
        yield* this.printTypeInfo(item, level + 1);
        yield ',';
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
    default: throw new Error(`unhandled kind ${(type as Type).kind}`);
  }
}
