export { type AstNode } from './core/ast';

import { ParseOperation } from './core/parser';
import { AstToSerializationTree } from './core/astToSerializationTree';

import * as YAML_12 from './1.2';
import * as YAML_13 from './1.3';

export function parseStream(text: string) {
  const op = new ParseOperation(YAML_12.GRAMMAR, text);

  const node = op.parseAll(YAML_12.ROOT_PRODUCTION);

  return new AstToSerializationTree(YAML_12.NODE_CLASSES).handleStream(text, node);
}
