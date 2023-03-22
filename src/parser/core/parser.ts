import type {
  Grammar,
  GrammarNode,
} from './helpers';

import { CharSet } from './charSet';
import { AstNode, Parameters } from './ast';
import { safeAccessProxy } from '@/util/safeAccessProxy';
import { single, charUtf16Width, objectHasOwn } from '@/util';

import { EventEmitter } from '@/util/EventEmitter';

type ParseResult = readonly [readonly AstNode[], number] | null;

function isArray<T>(value: T): value is T & readonly any[] {
  return Array.isArray(value);
}

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
      return this.parseRef(index, parameters, node);
    } else if (isArray(node)) {
      return this.parseSequence(index, parameters, node);
    } else if (typeof node === 'function') {
      return this.parse(index, parameters, node(safeAccessProxy(parameters)));
    } else if (node instanceof CharSet) {
      const codePoint = this.text.codePointAt(index);

      if (codePoint !== undefined && node.has(codePoint)) {
        return [[], index + charUtf16Width(codePoint)] as const;
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
        ] as const;
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
        return [[], j] as const;
      } else {
        return null;
      }
    } else if (node.type === 'REF') {
      return this.parseRef(index, node.parameters, node.name);
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
    }

    throw new TypeError(node);
  }

  parseRef(
    index: number,
    parameters: Parameters,
    name: string,
  ) {
    this.stack.push(name);
    try {
      if (!objectHasOwn(this.grammar, name)) throw new TypeError(`No production ${name}`);

      const params = [parameters.n, parameters.c, parameters.t].filter(p => p !== undefined);
      const displayName = name + (params.length ? `(${params.join(',')})` : '');

      const backtrackCacheKey = `${index}:${displayName}`;
      if (this.backtrackCache.has(backtrackCacheKey)) {
        return null;
      }

      this.emit('node.in', { displayName, index });
      const result = this.parse(index, parameters, this.grammar[name] as GrammarNode);
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
    min: number,
    arg: (m: number) => GrammarNode,
  ) {
    let m = 0;
    while (this.text[index + m] === ' ') m++;

    if (m >= min) {
      return this.parse(index, parameters, arg(m));
    } else {
      return null;
    }
  }
}
