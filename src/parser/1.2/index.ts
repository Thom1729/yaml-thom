import { ParseOperation } from '../core/parser';
export { type AstNode } from '../core/ast';

import { GRAMMAR } from './grammar';
import { astToSerializationTree } from './astToSerializationTree';


export function parseStream(text: string) {
  const op = new ParseOperation(GRAMMAR, text);

  const node = op.parseAll('l-yaml-stream');

  return astToSerializationTree(text, node);
}
