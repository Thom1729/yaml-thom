import type {
  Grammar,
  GrammarNode,
  RefParameters,
} from './helpers';

import { CharSet } from './charSet';
import { AstNode, Parameters } from './ast';
import { safeAccessProxy } from '@/util/safeAccessProxy';
import { single, charUtf16Width, objectEntries } from '@/util';

import { EventEmitter } from '@/util/EventEmitter';

type ParseResult = readonly [readonly AstNode[], number] | null;

export class ParseOperation extends EventEmitter<{
  'node': { displayName: string, index: number, },
  'node.in': object,
  'node.out': { result: ParseResult },
}> {
  readonly grammar: Grammar;
  readonly text: string;

  readonly backtrackCache = new Set<string>();

  readonly stack: string[] = [];

  constructor(grammar: Grammar, text: string) {
    super();
    this.grammar = grammar;
    this.text = text;
  }

  parseAll<T extends string>(name: T) {
    const result = this.parse(0, {}, name);

    if (result === null) throw new Error('parse failed');

    const [nodes, index] = result;
    const node = single(nodes) as AstNode<T>;

    if (index !== this.text.length) {
      throw new TypeError(`did not parse entire string`);
    }

    return node;
  }

  parse(
    index: number,
    parameters: Parameters,
    node: GrammarNode,
  ): ParseResult {
    if (typeof node === 'string') {
      return this.parseRef(index, parameters, {}, node);
    } else if (node instanceof CharSet) {
      const codePoint = this.text.codePointAt(index);

      if (codePoint !== undefined && node.has(codePoint)) {
        return [[], index + charUtf16Width(codePoint)];
      } else {
        return null;
      }
    } else if (node.type === 'NAMED') {
      const result = this.parse(index, parameters, node.child);
      if (result) {
        const [content, j] = result;
        return [
          [{
            name: node.name,
            parameters,
            content,
            range: [index, j]
          }],
          j,
        ];
      } else {
        return null;
      }
    } else if (node.type === 'EMPTY') {
      return [[], index];
    } else if (node.type === 'START_OF_LINE') {
      if (index === 0 || this.text[index - 1] === '\r' || this.text[index - 1] === '\n') {
        return [[], index];
      } else {
        return null;
      }
    } else if (node.type === 'END_OF_INPUT') {
      if (index === this.text.length) {
        return [[], index];
      } else {
        return null;
      }
    } else if (node.type === 'STRING') {
      const j = index + node.string.length;
      if (this.text.slice(index, j) === node.string) {
        return [[], j];
      } else {
        return null;
      }
    } else if (node.type === 'REF') {
      return this.parseRef(index, parameters, node.parameters, node.name);
    } else if (node.type === 'SEQUENCE') {
      return this.parseSequence(index, parameters, node.children);
    } else if (node.type === 'FIRST') {
      return this.parseFirst(index, parameters, node.children);
    } else if (node.type === 'REPEAT') {
      return this.parseRepeat(index, parameters, node.child, node.min, node.max);
    } else if (node.type === 'LOOKAHEAD') {
      return this.parseLookahead(index, parameters, node.child, node.positive);
    } else if (node.type === 'LOOKBEHIND') {
      return this.parseLookbehind(index, node.charSet);
    } else if (node.type === 'DETECT_INDENTATION') {
      return this.parseDetectIndentation(index, parameters, node.min, node.child);
    } else if (node.type === 'CONTEXT') {
      return this.parseContext(index, parameters, node.parameter, node.cases);
    }

    throw new TypeError(node);
  }

  parseRef(
    index: number,
    oldParameters: Parameters,
    refParameters: RefParameters,
    name: string,
  ) {
    this.stack.push(name);
    try {
      const parameters = Object.fromEntries(objectEntries(refParameters).map(
        ([name, given]) => {
          let value;
          if (typeof given === 'function') {
            value = given(safeAccessProxy(oldParameters));
          } else {
            value = given;
          }

          return [name, value] as const;
        }
      )) as Parameters;

      const params = [parameters.n, parameters.c, parameters.t].filter(p => p !== undefined);
      const displayName = name + (params.length ? `(${params.join(',')})` : '');

      const backtrackCacheKey = `${index}:${displayName}`;
      if (this.backtrackCache.has(backtrackCacheKey)) {
        return null;
      }

      const productionBody = this.grammar[name];
      if (productionBody === undefined) {
        console.error(`Stack: ${this.stack.slice().reverse().join(' ')}`);
        throw new TypeError(`No production ${name}`);
      }

      this.emit('node.in', { displayName, index });

      const result = typeof productionBody === 'function'
        ? this.parse(index, parameters, productionBody(safeAccessProxy(parameters)))
        : this.parse(index, parameters, productionBody);

      this.emit('node.out', { displayName, index, result });

      if (result) {
        const [content, j] = result;
        return [
          [{
            name,
            parameters,
            content,
            range: [index, j]
          }],
          j,
        ] as const;
      } else {
        this.backtrackCache.add(backtrackCacheKey);
        return null;
      }
    } finally {
      this.stack.pop();
    }
  }

  parseSequence(
    index: number,
    parameters: Parameters,
    children: readonly GrammarNode[],
  ) {
    const ret = [];
    let j = index;

    for (const child of children) {
      const result = this.parse(j, parameters, child);
      if (result === null) {
        return null;
      } else {
        const [nodes, k] = result;
        ret.push(...nodes);
        j = k;
      }
    }

    return [ret, j] as const;
  }

  parseFirst(
    index: number,
    parameters: Parameters,
    children: readonly GrammarNode[],
  ) {
    for (const child of children) {
      const result = this.parse(index, parameters, child);
      if (result !== null) return result;
    }
    return null;
  }

  parseRepeat(
    index: number,
    parameters: Parameters,
    child: GrammarNode,
    min: number,
    max: number,
  ) {
    const ret = [];
    let j = index;
    let count = 0;

    for (; count < max; count++) {
      const result = this.parse(j, parameters, child);
      if (result !== null) {
        const [nodes, k] = result;
        const isZeroWidth = (j === k);

        ret.push(...nodes);
        j = k;

        if (isZeroWidth && max === Infinity) {
          if (j < this.text.length) { // else it should be fixed by line ending normalization
            console.error(`Warning: unbounded repeat matched zero characters at ${j}/${this.text.length}.`);
            console.error(`Stack: ${this.stack.slice().reverse().join(' ')}`);
            console.error(child);
          }
          break;
        }
      } else {
        break;
      }
    }

    if (count >= min) {
      return [ret, j] as const;
    } else {
      return null;
    }
  }

  parseLookahead(
    index: number,
    parameters: Parameters,
    child: GrammarNode,
    positive: boolean,
  ) {
    const result = this.parse(index, parameters, child);
    return ((result === null) !== positive)
      ? [[], index] as const
      : null;
  }

  parseLookbehind(
    index: number,
    charSet: CharSet,
  ) {
    // TODO handle prev char is astral
    if (index > 0 && charSet.has(this.text.charCodeAt(index - 1))) {
      return [[], index] as const;
    } else {
      return null;
    }
  }

  parseDetectIndentation(
    index: number,
    parameters: Parameters,
    min: number | ((n: number) => number),
    arg: GrammarNode | ((m: number) => GrammarNode),
  ) {
    let minValue;
    if (typeof min === 'function') {
      const n = parameters.n;
      if (n === undefined) throw new Error(`n not defined`);
      minValue = min(n);
    } else {
      minValue = min;
    }

    let m = 0;
    while (this.text[index + m] === ' ') m++;

    const child = typeof arg === 'function' ? arg(m) : arg;

    if (m >= minValue) {
      return this.parse(index, { ...parameters, m }, child);
    } else {
      return null;
    }
  }

  parseContext(
    index: number,
    parameters: Parameters,
    parameter: keyof Parameters,
    cases: { [K in string]?: GrammarNode },
  ) {
    const value = parameters[parameter];
    if (value === undefined) throw new Error(`Parameter ${parameter} is undefined`);

    const child = cases[value];
    if (child === undefined) throw new Error(`Unhandled value ${value} for parameter ${parameter}`);

    return this.parse(index, parameters, child);
  }
}
