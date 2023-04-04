import { ParseOperation } from '../core/parser';

import { GRAMMAR } from './grammar';
import { astToSerializationTree } from './astToSerializationTree';

export function parseStream(text: string) {
  const op = new ParseOperation(GRAMMAR, text);

  const node = op.parseAll('yaml-stream');

  return astToSerializationTree(text, node);
}
