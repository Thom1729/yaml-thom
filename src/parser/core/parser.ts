import type {
  Grammar,
  GrammarNode,
  RefParameters,
} from './grammarType';

import type { AstNode, Parameters, Mark } from './ast';
import {
  single, charUtf16Width, strictEntries, strictFromEntries, isArray, assertNotUndefined,
  type CodePoint,
} from '@/util';

type ParseResult = readonly [readonly AstNode[], Mark] | null;

interface GrammarErrorArgs {
  node: GrammarNode;
  stack: readonly ParseStackEntry[];
  parameters: object;
  cause: unknown;
}

function formatRef(name: string, parameters: Parameters) {
  let ret = name;
  const parameterEntries = strictEntries(parameters);
  if (parameterEntries.length) {
    ret += '(' + parameterEntries.map(([name, value]) => `${name}: ${value}`).join(', ') + ')';
  }
  return ret;
}

class GrammarError extends Error {
  node: GrammarNode;
  parserStack: readonly ParseStackEntry[];
  parameters: object;

  constructor({ node, stack, parameters, cause }: GrammarErrorArgs) {
    const stackString = stack.map(entry => formatRef(entry.node.name, entry.parameters)).join('\n');
    super(`Failed to parse ${node.type} node in ${stack[stack.length - 1].node.name} at:\n${stackString}`, { cause });
    Object.setPrototypeOf(this, GrammarError.prototype);
    this.node = node;
    this.parserStack = stack;
    this.parameters = parameters;
  }
}

interface ParseStackEntry {
  node: GrammarNode<'REF'>,
  parameters: Parameters,
}

export function parseAll<T extends string>(
  lines: readonly string[],
  startMark: Mark,
  lineEnd: number,
  grammar: Grammar,
  rootProduction: T,
) {
  const operation = new ParseOperation(grammar, lines, lineEnd);
  const result = operation.parseRef(startMark, {}, {
    type: 'REF',
    name: rootProduction,
    parameters: {},
  });

  if (result === null) throw new Error('parse failed');

  const [nodes, endMark] = result;
  const node = single(nodes) as AstNode<T>;

  if (endMark.row < lineEnd) {
    throw new TypeError(`did not parse entire string`);
  }

  return node;
}

class ParseOperation {
  readonly grammar: Grammar;
  readonly lines: readonly string[];
  readonly linesEnd: number;

  readonly backtrackCache = new Set<string>();

  readonly stack: ParseStackEntry[] = [];

  constructor(grammar: Grammar, lines: readonly string[], lineEnd: number) {
    this.grammar = grammar;
    this.lines = lines;
    this.linesEnd = lineEnd;
  }

  atEndOfInput(mark: Mark) {
    return mark.row >= this.linesEnd;
  }

  advance(mark: Mark, n: number) {
    let { index, row, column } = mark;
    index += n;
    column += n;
    while (column > 0 && column >= (this.lines[row].length)) {
      column -= (this.lines[row].length);
      row++;
    }
    return { index, row, column };
  }

  matchString(mark: Mark, string: string) {
    if (string === '') {
      return true;
    } else if (this.atEndOfInput(mark)) {
      return false;
    } else {
      return this.lines[mark.row].slice(mark.column, mark.column + string.length) === string;
    }
  }

  parse(
    startMark: Mark,
    parameters: Parameters,
    node: GrammarNode,
  ): ParseResult {
    try {
      if (node.type === 'EMPTY') {
        return [[], startMark];
      } else if (node.type === 'START_OF_LINE') {
        // Technically imprecise because it matches the end of stream even if it's not terminated by a newline
        if (startMark.column === 0) {
          return [[], startMark];
        } else {
          return null;
        }
      } else if (node.type === 'END_OF_INPUT') {
        if (this.atEndOfInput(startMark)) {
          return [[], startMark];
        } else {
          return null;
        }
      } else if (node.type === 'STRING') {
        if (this.matchString(startMark, node.string)) {
          const endMark = this.advance(startMark, node.string.length);
          return [[], endMark];
        } else {
          return null;
        }
      } else if (node.type === 'CHAR_SET') {
        return this.parseCharSet(startMark, node.ranges);
      } else if (node.type === 'REF') {
        return this.parseRef(startMark, parameters, node);
      } else if (node.type === 'SEQUENCE') {
        return this.parseSequence(startMark, parameters, node.children);
      } else if (node.type === 'FIRST') {
        return this.parseFirst(startMark, parameters, node.children);
      } else if (node.type === 'REPEAT') {
        return this.parseRepeat(startMark, parameters, node.child, node.min, node.max);
      } else if (node.type === 'LOOKAHEAD') {
        return this.parseLookahead(startMark, parameters, node.child, node.positive);
      } else if (node.type === 'LOOKBEHIND') {
        return this.parseLookbehind(startMark, parameters, node.child);
      } else if (node.type === 'DETECT_INDENTATION') {
        return this.parseDetectIndentation(startMark, parameters, node);
      } else if (node.type === 'CONTEXT') {
        return this.parseContext(startMark, parameters, node);
      }

      throw new TypeError(node);
    } catch (e) {
      if (e instanceof GrammarError) {
        throw e;
      } else {
        throw new GrammarError({
          node,
          stack: this.stack,
          parameters,
          cause: e,
        });
      }
    }
  }

  parseCharSet(
    startMark: Mark,
    ranges: readonly (readonly [number, number])[],
  ) {
    if (startMark.row >= this.linesEnd) return null;

    const codePoint = this.lines[startMark.row]?.codePointAt(startMark.column) as CodePoint | undefined;

    if (codePoint === undefined) return null; // EOF

    for (const [min, max] of ranges) {
      if (codePoint >= min && codePoint <= max) {
        return [[], this.advance(startMark, charUtf16Width(codePoint))] as const;
      }
    }

    return null;
  }

  parseRef(
    startMark: Mark,
    parameters: Parameters,
    node: GrammarNode<'REF'>,
  ) {
    const getParameter = safeGetter(parameters);

    const newParameters = strictFromEntries(
      strictEntries(node.parameters).map(([p, given]) => [p, resolveParameter(given, getParameter)])
    ) as Parameters;

    this.stack.push({ node, parameters: newParameters });

    const params = [newParameters.n, newParameters.c, newParameters.t].filter(p => p !== undefined);
    const displayName = node.name + (params.length ? `(${params.join(',')})` : '');

    const backtrackCacheKey = `${startMark.index}:${displayName}`;
    if (this.backtrackCache.has(backtrackCacheKey)) {
      this.stack.pop();
      return null;
    }

    const production = this.grammar[node.name];
    if (production === undefined) {
      throw new Error(`No production ${node.name}`);
    }

    const result = this.parse(startMark, newParameters, production.body);

    if (result) {
      const [content, endMark] = result;
      this.stack.pop();
      return [
        [{
          name: node.name,
          parameters: newParameters,
          content,
          range: [startMark, endMark],
        }],
        endMark,
      ] as const;
    } else {
      this.backtrackCache.add(backtrackCacheKey);
      this.stack.pop();
      return null;
    }
  }

  parseSequence(
    startMark: Mark,
    parameters: Parameters,
    children: readonly GrammarNode[],
  ) {
    const ret = [];
    let m = startMark;

    for (const child of children) {
      const result = this.parse(m, parameters, child);
      if (result === null) {
        return null;
      } else {
        const [nodes, endMark] = result;
        ret.push(...nodes);
        m = endMark;
      }
    }

    return [ret, m] as const;
  }

  parseFirst(
    startMark: Mark,
    parameters: Parameters,
    children: readonly GrammarNode[],
  ) {
    for (const child of children) {
      const result = this.parse(startMark, parameters, child);
      if (result !== null) return result;
    }
    return null;
  }

  parseRepeat(
    startMark: Mark,
    parameters: Parameters,
    child: GrammarNode,
    min: number,
    max: number | null,
  ) {
    const ret = [];
    let m = startMark;
    let count = 0;

    for (; max === null || count < max; count++) {
      const result = this.parse(m, parameters, child);
      if (result !== null) {
        const [nodes, endMark] = result;
        const isZeroWidth = (endMark.index === m.index);

        ret.push(...nodes);
        m = endMark;

        if (isZeroWidth && max === null) {
          if (m.row < this.linesEnd) { // else it should be fixed by line ending normalization
            console.error(`Warning: unbounded repeat matched zero characters at ${m.index}.`);
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
      return [ret, m] as const;
    } else {
      return null;
    }
  }

  parseLookahead(
    startMark: Mark,
    parameters: Parameters,
    child: GrammarNode,
    positive: boolean,
  ) {
    const result = this.parse(startMark, parameters, child);
    return ((result === null) !== positive)
      ? [[], startMark] as const
      : null;
  }

  parseLookbehind(
    startMark: Mark,
    parameters: Parameters,
    child: GrammarNode,
  ) {
    // Warning: this only works right if the child is a single non-astral character!
    // This shouldn't matter for the YAML grammar.
    // In the long run, we should remove lookbehinds from the grammar.
    const m = {
      index: startMark.index - 1,
      row: startMark.row,
      column: startMark.column - 1,
    };
    if (startMark.index > 0 && this.parse(m, parameters, child) !== null) {
      return [[], startMark] as const;
    } else {
      return null;
    }
  }

  parseDetectIndentation(
    startMark: Mark,
    parameters: Parameters,
    node: GrammarNode<'DETECT_INDENTATION'>,
  ) {
    const { min, child } = node;
    let minValue;
    if (typeof min === 'function') {
      const n = parameters.n;
      if (n === undefined) throw new Error(`n not defined`);
      minValue = min(n);
    } else {
      minValue = min;
    }

    let m = 0;
    while (this.lines[startMark.row]?.[startMark.column + m] === ' ') m++;

    if (m >= minValue) {
      return this.parse(startMark, { ...parameters, m }, child);
    } else {
      return null;
    }
  }

  parseContext(
    startMark: Mark,
    parameters: Parameters,
    node: GrammarNode<'CONTEXT'>,
  ) {
    for (const [constraints, child] of node.cases) {
      if (strictEntries(constraints).every(([p, value]) => parameters[p] === value)) {
        return this.parse(startMark, parameters, child);
      }
    }
    throw new Error(`Unhandled case`);
  }
}

function safeGetter<T extends object>(obj: T) {
  return function <K extends string & keyof T>(parameterName: K) {
    const value = obj[parameterName];
    assertNotUndefined(value, `Parameter ${parameterName} is undefined`);
    return value as Required<T>[K];
  };
}

function resolveParameter(
  given: RefParameters[keyof RefParameters],
  getParameter: <T extends keyof Parameters>(parameterName: T) => Required<Parameters>[T],
) {
  if (given === 'in-flow(c)') {
    const c = getParameter('c');
    switch (c) {
      case 'FLOW-OUT': case 'FLOW-IN': return 'FLOW-IN';
      case 'BLOCK-KEY': case 'FLOW-KEY': return 'FLOW-KEY';
      default: throw new TypeError(`Unhandled context ${c} in in-flow(c)`);
    }
  } else if (given === 'n' || given === 'm' || given === 'c' || given === 't') {
    return getParameter(given);
  } else if (isArray(given)) {
    return given
      .map(x => (typeof x === 'string') ? getParameter(x) : x)
      .reduce((a, b) => a + b, 0);
  } else {
    return given;
  }
}
