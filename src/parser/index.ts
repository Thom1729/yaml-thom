export { type AstNode } from './core/ast';

import { ParseOperation } from './core/parser';
import { AstToSerializationTree } from './core/astToSerializationTree';

import versions from './versions';

type YamlVersion = keyof typeof versions;

interface ParseOptions {
  version?: YamlVersion;
}

const DEFAULT_OPTIONS = {
  version: '1.3',
} satisfies Required<ParseOptions>;

export function parseStream(text: string, options?: ParseOptions) {
  const combinedOptions = { ...DEFAULT_OPTIONS, ...options };

  const { grammar, rootProduction, nodeClasses } = versions[combinedOptions.version];

  const node = new ParseOperation(grammar, text).parseAll(rootProduction);

  return new AstToSerializationTree(nodeClasses).handleStream(text, node);
}
