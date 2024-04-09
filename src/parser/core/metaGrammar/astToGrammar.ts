import { AstNode } from '@/parser';

import { parseHex, single, groupBy, strictFromEntries, isKeyOf, parseDecimal, Y } from '@/util';

import { groupNodes } from '../transformAst';

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

  type Grammar,
  type GrammarNode,
  context,
} from '../grammarType';

import { ContextType, ChompingBehavior } from '@/parser/core/ast';

////

export function astToGrammar(ast: AstNode, text: string): Grammar {
  function nodeText(node: AstNode) {
    return text.slice(node.range[0].index, node.range[1].index);
  }

  const foo = ast.content
    .filter(node => node.name === 'production')
    .map(productionNode => {
      const {
        productionNumber,
        name,
        parameters,
        alternation,
      } = groupNodes(productionNode.content, {
        'productionNumber?%': ['productionNumber'],
        'name%': ['productionName'],
        'parameters*%': ['parameter'],
        'alternation': ['alternation'],
      }, nodeText);

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
    return [p as 'n' | 'c' | 't', undefined] as const;
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
    return text.slice(node.range[0].index, node.range[1].index);
  }

  return Y<GrammarNode, [AstNode]>((rec, node): GrammarNode => {
    switch (node.name) {
      case 'alternation':
      case 'sequence':
      case 'minus': {
        const [firstChild, ...rest] = node.content.filter(x => x.name !== 'space').map(rec);
        if (rest.length === 0) {
          return firstChild;
        } else {
          switch (node.name) {
            case 'alternation': return first(firstChild, ...rest);
            case 'sequence': return sequence(firstChild, ...rest);
            case 'minus': return minus(firstChild, ...rest);
          }
        }
        throw new Error('unreachable');
      }

      case 'quantified': {
        const { atom, quantifier } = groupNodes(node.content, {
          atom: ['atom'],
          'quantifier*%': ['quantifier'],
        }, nodeText);

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
      }

      case 'atom': return rec(single(node.content));

      case 'parenthesized': return rec(groupNodes(node.content, {
        alternation: ['alternation'],
      }).alternation);

      case 'hexChar': return charSet(parseHex(nodeText(node).slice(1)));

      case 'charRange': {
        const { hexChar } = groupNodes(node.content, { 'hexChar+%': ['hexChar'] }, nodeText);

        const range = hexChar.map(c => parseHex(c.slice(1))) as [number, number];

        return charSet(range);
      }

      case 'string': return str(nodeText(node).slice(1, -1));

      case 'special': {
        const text = nodeText(node).slice(1, -1);
        switch (text) {
          case 'empty': return empty;
          case 'start-of-line': return startOfLine;
          case 'end-of-input': return endOfInput;
          default: throw new Error(`Unknown special production ${text}`);
        }
      }

      case 'lookaround': {
        const { lookaroundType, lookaroundOperator, alternation } = groupNodes(node.content, {
          'lookaroundType%': ['lookaroundType'],
          'lookaroundOperator%': ['lookaroundOperator'],
          'alternation': ['alternation'],
        }, nodeText);

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
      }

      case 'productionRef': {
        const { name, parameters } = groupNodes(node.content, {
          'name%': ['productionName'],
          'parameters*%': ['parameter']
        }, nodeText);

        const parameterFunctions = strictFromEntries(
          parameters.map((paramString) => {
            if (isKeyOf(paramString, ContextType)) {
              return [ 'c', paramString ];
            } else if (isKeyOf(paramString, ChompingBehavior)) {
              return [ 't', paramString ];
            } else {
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
                case 'in-flow(c)': return [ 'c', 'in-flow(c)'];

                case 't': return [ 't', 't' ];

                default: throw new Error(`Unknown parameter ${paramString}`);
              }
            }
          })
        );

        return ref(name, parameterFunctions);
      }
      default: throw new TypeError(`Unexpected node named ${node.name}`);
    }
  })(body);
}
