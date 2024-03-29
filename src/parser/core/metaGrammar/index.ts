import { grammar } from './grammarGrammar';
import { astToGrammar } from './astToGrammar';

import type { Grammar } from '../grammarType';

import { parseAll } from '../parser';

export function parseGrammar(text: string): Grammar {
  try {
    const lines = text.split(/^/gm);
    const ast = parseAll(lines, { index: 0, row: 0, column: 0 }, lines.length, grammar, 'grammar');

    return astToGrammar(ast, text);
  } catch (e) {
    throw new Error(`Failed to parse grammar`, { cause: e });
  }
}
