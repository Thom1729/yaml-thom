import type {
  Grammar,
  GrammarNode,
  RefParameters,
} from './grammarType';

import { AstNode, Parameters } from './ast';
import { single, charUtf16Width, strictEntries, strictFromEntries, isArray, assertNotUndefined } from '@/util';

import { EventEmitter } from '@/util/EventEmitter';

type ParseResult = readonly [readonly AstNode[], number] | null;

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
  text: string,
  grammar: Grammar,
  rootProduction: T,
) {
  const operation = new ParseOperation(grammar, text);
  const result = operation.parseRef(0, {}, {
    type: 'REF',
    name: rootProduction,
    parameters: {},
  });

  if (result === null) throw new Error('parse failed');

  const [nodes, index] = result;
  const node = single(nodes) as AstNode<T>;

  if (index !== text.length) {
    throw new TypeError(`did not parse entire string`);
  }

  return node;
}

class ParseOperation extends EventEmitter<{
  'node': { displayName: string, index: number, },
  'node.in': object,
  'node.out': { result: ParseResult },
}> {
  readonly grammar: Grammar;
  readonly text: string;

  readonly backtrackCache = new Set<string>();

  readonly stack: ParseStackEntry[] = [];

  constructor(grammar: Grammar, text: string) {
    super();
    this.grammar = grammar;
    this.text = text;
  }

  parse(
    index: number,
    parameters: Parameters,
    node: GrammarNode,
  ): ParseResult {
    try {
      if (node.type === 'EMPTY') {
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
      } else if (node.type === 'CHAR_SET') {
        return this.parseCharSet(index, node.ranges);
      } else if (node.type === 'REF') {
        return this.parseRef(index, parameters, node);
      } else if (node.type === 'SEQUENCE') {
        return this.parseSequence(index, parameters, node.children);
      } else if (node.type === 'FIRST') {
        return this.parseFirst(index, parameters, node.children);
      } else if (node.type === 'REPEAT') {
        return this.parseRepeat(index, parameters, node.child, node.min, node.max);
      } else if (node.type === 'LOOKAHEAD') {
        return this.parseLookahead(index, parameters, node.child, node.positive);
      } else if (node.type === 'LOOKBEHIND') {
        return this.parseLookbehind(index, parameters, node.child);
      } else if (node.type === 'DETECT_INDENTATION') {
        return this.parseDetectIndentation(index, parameters, node);
      } else if (node.type === 'CONTEXT') {
        return this.parseContext(index, parameters, node);
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
    index: number,
    ranges: readonly (readonly [number, number])[],
  ) {
    const codePoint = this.text.codePointAt(index);

    if (codePoint === undefined) return null; // EOF

    for (const [min, max] of ranges) {
      if (codePoint >= min && codePoint <= max) {
        return [[], index + charUtf16Width(codePoint)] as const;
      }
    }

    return null;
  }

  parseRef(
    index: number,
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

    const backtrackCacheKey = `${index}:${displayName}`;
    if (this.backtrackCache.has(backtrackCacheKey)) {
      this.stack.pop();
      return null;
    }

    const production = this.grammar[node.name];
    if (production === undefined) {
      throw new Error(`No production ${node.name}`);
    }

    this.emit('node.in', { displayName, index });

    const result = this.parse(index, newParameters, production.body);

    this.emit('node.out', { displayName, index, result });

    if (result) {
      const [content, j] = result;
      this.stack.pop();
      return [
        [{
          name: node.name,
          parameters: newParameters,
          content,
          range: [index, j],
        }],
        j,
      ] as const;
    } else {
      this.backtrackCache.add(backtrackCacheKey);
      this.stack.pop();
      return null;
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
    max: number | null,
  ) {
    const ret = [];
    let j = index;
    let count = 0;

    for (; max === null || count < max; count++) {
      const result = this.parse(j, parameters, child);
      if (result !== null) {
        const [nodes, k] = result;
        const isZeroWidth = (j === k);

        ret.push(...nodes);
        j = k;

        if (isZeroWidth && max === null) {
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
    parameters: Parameters,
    child: GrammarNode,
  ) {
    // Warning: this only works right if the child is a single non-astral character!
    // This shouldn't matter for the YAML grammar.
    // In the long run, we should remove lookbehinds from the grammar.
    if (index > 0 && this.parse(index - 1, parameters, child) !== null) {
      return [[], index] as const;
    } else {
      return null;
    }
  }

  parseDetectIndentation(
    index: number,
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
    while (this.text[index + m] === ' ') m++;

    if (m >= minValue) {
      return this.parse(index, { ...parameters, m }, child);
    } else {
      return null;
    }
  }

  parseContext(
    index: number,
    parameters: Parameters,
    node: GrammarNode<'CONTEXT'>,
  ) {
    for (const [constraints, child] of node.cases) {
      if (strictEntries(constraints).every(([p, value]) => parameters[p] === value)) {
        return this.parse(index, parameters, child);
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
