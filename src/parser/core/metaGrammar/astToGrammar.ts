import { AstNode } from '@/parser';

import { parseHex, single, groupBy, strictFromEntries, isKeyOf, parseDecimal } from '@/util';

import { groupNodes, transformAst } from '../transformAst';

import {
  str,
  sequence,
  first,
  optional,
  plus,
  star,
  repeat,
  lookahead,
  negativeLookahead,
  lookbehind,
  minus,
  ref,
  empty,
  startOfLine,
  endOfInput,
  charSet,

  type GrammarNode,
  context,
} from '@/parser/core/helpers';

import { ContextType, ChompingBehavior } from '@/parser/core/ast';

////

function isNotUndefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

function collapse<R>(f: (node: [R, ...R[]]) => R) {
  return (
    node: AstNode,
    rec: (node: AstNode) => R,
  ) => {
    const foo = node.content.map(rec).filter(isNotUndefined);
    if (foo.length === 1) {
      return single(foo);
    } else {
      return f(foo as [R, ...R[]]);
    }
  };
}

export function astToGrammar(ast: AstNode, text: string) {
  const foo = ast.content
    .filter(node => node.name === 'production')
    .map(productionNode => {
      const {
        productionNumber,
        productionName: name,
        parameter: parameters,
        alternation,
      } = groupNodes(productionNode.content, {
        return: ['productionNumber?%', 'productionName%', 'parameter*%', 'alternation'],
        recurse: ['productionRef', 'productionParameters'],
        ignore: ['space'],
      }, text);

      const number = (productionNumber !== null) ? parseDecimal(productionNumber.slice(1, -1)) : null;

      const body = parseBody(alternation, text);

      return {
        number,
        name,
        parameters,
        body,
      };
    });

  const pairs = Array.from(groupBy(foo, def => def.name)).map(([name, defs]) => {
    const numbers = new Set(defs.map(d => d.number).filter(n => n !== null));
    if (numbers.size > 1) throw new Error(`Conflicting numbers for ${name}`);
    const number = Array.from(numbers)[0] ?? null;

    const parameters = defs[0].parameters.map(p => valueToParam(p)[0]);

    const cases = defs.map(def => {
      const x = strictFromEntries(
        def.parameters.map(valueToParam).filter(([,v]) => v !== undefined)
      );

      return [x, def.body] as const;
    });

    const noConstraints = cases.length === 1 && Object.values(cases[0][0]).every(v => v === undefined);
    const body = noConstraints ? cases[0][1] : context(...cases);

    const production = {
      type: 'PRODUCTION',
      number: number,
      parameters,
      body,
    } as const;

    return [name, production] as const;
  });

  return strictFromEntries(pairs);
}

function valueToParam(p: string) {
  if (p === 'n' || p === 'c' || p === 't' || p === 'n+1') {
    return [p, undefined] as const;
  } else if (isKeyOf(p, ContextType)) {
    return ['c', p] as const;
  } else if (isKeyOf(p, ChompingBehavior)) {
    return ['t', p] as const;
  } else {
    return ['n', parseDecimal(p)] as const;
  }
}

function parseBody(body: AstNode, text: string) {
  function nodeText(node: AstNode) {
    return text.slice(...node.range);
  }

  return transformAst<GrammarNode>(body, {
    space: null,

    alternation: collapse(children => first(...children)),
    sequence: collapse(children => sequence(...children)),
    minus: collapse(children => minus(...children)),

    quantified: (node, rec) => {
      const { atom, quantifier } = groupNodes(node.content, {
        return: ['atom', 'quantifier*%'],
      }, text);

      let ret = rec(atom);

      for (const q of quantifier) {
        switch (q) {
          case '?': ret = optional(ret); break;
          case '*': ret = star(ret); break;
          case '+': ret = plus(ret); break;
          default: {
            const match = /\{(\d+)\}/.exec(q);
            if (match) {
              const n = parseDecimal(match[1]);
              ret = repeat(ret, n, n);
            } else {
              throw new Error(`Unknown quantifier ${quantifier}`);
            }
          }
        }
      }

      return ret;
    },

    atom: (node, rec) => rec(single(node.content)),

    parenthesized: (node, rec) => rec(groupNodes(node.content, { return: ['alternation'], ignore: ['space'] }).alternation),

    hexChar: node => charSet(parseHex(nodeText(node).slice(1))),

    charRange: node => {
      const { hexChar } = groupNodes(node.content, { return: ['hexChar+%'] }, text)

      const range = hexChar.map(c => parseHex(c.slice(1))) as [number, number];

      return charSet(range);
    },

    string: node => str(nodeText(node).slice(1, -1)),

    special: node => {
      const text = nodeText(node).slice(1, -1);
      switch (text) {
        case 'empty': return empty;
        case 'start-of-line': return startOfLine;
        case 'end-of-input': return endOfInput;
        default: throw new Error(`Unknown special production ${text}`);
      }
    },

    lookaround: (node, rec) => {
      const { lookaroundType, lookaroundOperator, alternation } = groupNodes(node.content, {
        return: ['lookaroundType%', 'lookaroundOperator%', 'alternation'],
        ignore: ['space'],
      }, text);

      const child = rec(alternation);

      if (lookaroundType === 'lookahead') {
        if (lookaroundOperator === '=') {
          return lookahead(child);
        } else {
          return negativeLookahead(child);
        }
      } else {
        if (lookaroundOperator === '=') {
          return lookbehind(child);
        } else {
          throw new Error(`Negative lookbehind not supported`);
        }
      }
    },

    productionRef: (node) => {
      const {
        productionName: name,
        parameter: parameters,
      } = groupNodes(node.content, {
        return: ['productionName%', 'parameter*%'],
        recurse: ['productionParameters'],
      }, text);

      const parameterFunctions = strictFromEntries(
        parameters.map((paramString) => {
          switch (paramString) {
            case '0': return [ 'n', 0 ];
            case '1': return [ 'n', 1 ];
            case '-1': return [ 'n', -1 ];
            case 'n': return [ 'n', 'n' ];
            case 'n+1': return [ 'n', ['n', 1] ];
            case 'n-1': return [ 'n', ['n', -1] ];
            case 'm': return [ 'n', 'm' ];
            case 'n+m': return [ 'n', ['n', 'm'] ];
            case 'n+1+m': return [ 'n', ['n', 'm', 1] ];

            case 'c': return [ 'c', 'c' ];
            case 'BLOCK-IN': case 'BLOCK-OUT': case 'BLOCK-KEY':
            case 'FLOW-IN': case 'FLOW-OUT': case 'FLOW-KEY':
              return [ 'c', paramString ];
            case 'in-flow(c)': return [ 'c', 'in-flow(c)'];

            case 't': return [ 't', 't' ];
            case 'STRIP': case 'KEEP': case 'CLIP': return [ 't', paramString ];

            default: throw new Error(`Unknown parameter ${paramString}`);
          }
        })
      );

      return ref(name, parameterFunctions);
    },
  });
}
