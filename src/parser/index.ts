import { ParseOperation } from './core/parser';
import { GRAMMAR } from './1.3/grammar';
import { astToSerializationTree } from './1.3/astToSerializationTree';

export { type AstNode } from './core/ast';

export function parseStream(text: string) {
  const op = new ParseOperation(GRAMMAR, text);

  const node = op.parseAll('yaml-stream');

  return astToSerializationTree(text, node);
}
