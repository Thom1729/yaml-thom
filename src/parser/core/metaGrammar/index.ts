import { grammar } from './grammarGrammar';
import { astToGrammar } from './astToGrammar';

import type { Grammar } from '../helpers';

import { ParseOperation } from '../parser';

export function parseGrammar(text: string): Grammar {
  const parseResult = new ParseOperation(grammar, text).parse(0, {}, 'grammar');
  if (parseResult === null) throw new Error('parse failed');
  const ast = parseResult[0][0];

  return astToGrammar(ast, text) as Grammar;
}
