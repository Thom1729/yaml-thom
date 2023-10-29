import { grammar } from './grammarGrammar';
import { astToGrammar } from './astToGrammar';

import type { Grammar } from '../grammarType';

import { parseAll } from '../parser';

export function parseGrammar(text: string): Grammar {
  try {
    const ast = parseAll(text.split(/^/gm), grammar, 'grammar');

    return astToGrammar(ast, text);
  } catch (e) {
    throw new Error(`Failed to parse grammar`, { cause: e });
  }
}
