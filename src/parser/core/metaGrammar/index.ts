import { grammar } from './grammarGrammar';
import { astToGrammar } from './astToGrammar';

import type { Grammar } from '../grammarType';

import { ParseOperation } from '../parser';

export function parseGrammar(text: string): Grammar {
  const ast = new ParseOperation(grammar, text).parseAll('grammar');

  return astToGrammar(ast, text) as Grammar;
}
