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
      yield `type ${t.name} =`;
      yield* this.printTypeInfo(t.value, 0);
      yield `;\n`;
    }
    yield '\n';
  }

  *printTypeInfo(value: Type, level: number): Tokens {
    if (value.kind === 'ref') {
      const ref = this.types.get(value.ref);
      assertNotUndefined(ref);
      this.enqueue(ref);
      yield ref.name;
    } else if (value.kind === 'name') {
      yield value.name;
      if (value.args.length > 0) {
        yield '<';
        for (const item of value.args) {
          yield* this.printTypeInfo(item, level + 1);
          yield ', ';
        }
        yield '>';
      }
    } else if (value.kind === 'string') {
      yield JSON.stringify(value.value);
    } else if (value.kind === 'union') {
      if (value.members.length === 0) {
        throw new Error();
      // } else if (value.members.length === 1) {
        // yield* this.printTypeInfo(value.members[0]);
      } else {
        for (const member of value.members) {
          yield '\n';
          yield level;
          yield '| ';
          yield* this.printTypeInfo(member, level + 1);
        }
      }
    } else if (value.kind === 'tuple') {
      yield '[';
      let first = true;
      for (const item of value.items) {
        if (first) {
          first = false;
        } else {
          yield ', ';
        }
        yield* this.printTypeInfo(item, level + 1);
      }
      yield ']';
    } else {
      throw new TypeError(`Unhandled kind ${(value as Type).kind}`);
    }
  }
}
