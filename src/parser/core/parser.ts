import type {
  Grammar,
  GrammarNode,
  RefParameters,
} from './grammarType';

import { AstNode, Parameters } from './ast';
import { single, charUtf16Width, strictEntries, strictFromEntries, isArray, assertNotUndefined } from '@/util';

interface Mark {
  index: number;
}
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
  text: string,
  grammar: Grammar,
  rootProduction: T,
) {
  const operation = new ParseOperation(grammar, text);
  const result = operation.parseRef({ index: 0 }, {}, {
    type: 'REF',
    name: rootProduction,
    parameters: {},
  });

  if (result === null) throw new Error('parse failed');

  const [nodes, { index }] = result;
  const node = single(nodes) as AstNode<T>;

  if (index !== text.length) {
    throw new TypeError(`did not parse entire string`);
  }

  return node;
}

class ParseOperation {
  readonly grammar: Grammar;
  readonly text: string;

  readonly backtrackCache = new Set<string>();

  readonly stack: ParseStackEntry[] = [];

  constructor(grammar: Grammar, text: string) {
    this.grammar = grammar;
    this.text = text;
  }

  parse(
    mark: Mark,
    parameters: Parameters,
    node: GrammarNode,
  ): ParseResult {
    const { index } = mark;
    try {
      if (node.type === 'EMPTY') {
        return [[], mark];
      } else if (node.type === 'START_OF_LINE') {
        if (index === 0 || this.text[index - 1] === '\r' || this.text[index - 1] === '\n') {
          return [[], mark];
        } else {
          return null;
        }
      } else if (node.type === 'END_OF_INPUT') {
        if (index === this.text.length) {
          return [[], mark];
        } else {
          return null;
        }
      } else if (node.type === 'STRING') {
        const j = index + node.string.length;
        if (this.text.slice(index, j) === node.string) {
          return [[], { index: j }];
        } else {
          return null;
        }
      } else if (node.type === 'CHAR_SET') {
        return this.parseCharSet(mark, node.ranges);
      } else if (node.type === 'REF') {
        return this.parseRef(mark, parameters, node);
      } else if (node.type === 'SEQUENCE') {
        return this.parseSequence(mark, parameters, node.children);
      } else if (node.type === 'FIRST') {
        return this.parseFirst(mark, parameters, node.children);
      } else if (node.type === 'REPEAT') {
        return this.parseRepeat(mark, parameters, node.child, node.min, node.max);
      } else if (node.type === 'LOOKAHEAD') {
        return this.parseLookahead(mark, parameters, node.child, node.positive);
      } else if (node.type === 'LOOKBEHIND') {
        return this.parseLookbehind(mark, parameters, node.child);
      } else if (node.type === 'DETECT_INDENTATION') {
        return this.parseDetectIndentation(mark, parameters, node);
      } else if (node.type === 'CONTEXT') {
        return this.parseContext(mark, parameters, node);
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
    mark: Mark,
    ranges: readonly (readonly [number, number])[],
  ) {
    const codePoint = this.text.codePointAt(mark.index);

    if (codePoint === undefined) return null; // EOF

    for (const [min, max] of ranges) {
      if (codePoint >= min && codePoint <= max) {
        return [[], { index: mark.index + charUtf16Width(codePoint) }] as const;
      }
    }

    return null;
  }

  parseRef(
    mark: Mark,
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

    const backtrackCacheKey = `${mark.index}:${displayName}`;
    if (this.backtrackCache.has(backtrackCacheKey)) {
      this.stack.pop();
      return null;
    }

    const production = this.grammar[node.name];
    if (production === undefined) {
      throw new Error(`No production ${node.name}`);
    }

    const result = this.parse(mark, newParameters, production.body);

    if (result) {
      const [content, { index: j }] = result;
      this.stack.pop();
      return [
        [{
          name: node.name,
          parameters: newParameters,
          content,
          range: [mark.index, j],
        }],
        { index: j },
      ] as const;
    } else {
      this.backtrackCache.add(backtrackCacheKey);
      this.stack.pop();
      return null;
    }
  }

  parseSequence(
    mark: Mark,
    parameters: Parameters,
    children: readonly GrammarNode[],
  ) {
    const ret = [];
    let j = mark.index;

    for (const child of children) {
      const result = this.parse({ index: j }, parameters, child);
      if (result === null) {
        return null;
      } else {
        const [nodes, { index: k }] = result;
        ret.push(...nodes);
        j = k;
      }
    }

    return [ret, { index: j }] as const;
  }

  parseFirst(
    mark: Mark,
    parameters: Parameters,
    children: readonly GrammarNode[],
  ) {
    for (const child of children) {
      const result = this.parse(mark, parameters, child);
      if (result !== null) return result;
    }
    return null;
  }

  parseRepeat(
    mark: Mark,
    parameters: Parameters,
    child: GrammarNode,
    min: number,
    max: number | null,
  ) {
    const ret = [];
    let j = mark.index;
    let count = 0;

    for (; max === null || count < max; count++) {
      const result = this.parse({ index: j }, parameters, child);
      if (result !== null) {
        const [nodes, { index: k }] = result;
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
      return [ret, { index: j }] as const;
    } else {
      return null;
    }
  }

  parseLookahead(
    mark: Mark,
    parameters: Parameters,
    child: GrammarNode,
    positive: boolean,
  ) {
    const result = this.parse(mark, parameters, child);
    return ((result === null) !== positive)
      ? [[], mark] as const
      : null;
  }

  parseLookbehind(
    mark: Mark,
    parameters: Parameters,
    child: GrammarNode,
  ) {
    // Warning: this only works right if the child is a single non-astral character!
    // This shouldn't matter for the YAML grammar.
    // In the long run, we should remove lookbehinds from the grammar.
    if (mark.index > 0 && this.parse({ index: mark.index - 1 }, parameters, child) !== null) {
      return [[], mark] as const;
    } else {
      return null;
    }
  }

  parseDetectIndentation(
    mark: Mark,
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
    while (this.text[mark.index + m] === ' ') m++;

    if (m >= minValue) {
      return this.parse(mark, { ...parameters, m }, child);
    } else {
      return null;
    }
  }

  parseContext(
    mark: Mark,
    parameters: Parameters,
    node: GrammarNode<'CONTEXT'>,
  ) {
    for (const [constraints, child] of node.cases) {
      if (strictEntries(constraints).every(([p, value]) => parameters[p] === value)) {
        return this.parse(mark, parameters, child);
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
