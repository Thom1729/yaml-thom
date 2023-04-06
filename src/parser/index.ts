export { type AstNode } from './core/ast';

import { ParseOperation } from './core/parser';
import { AstToSerializationTree } from './core/astToSerializationTree';

import * as YAML_12 from './1.2';
import * as YAML_13 from './1.3';

const versionSyntaxInfo = {
  '1.2': YAML_12,
  '1.3': YAML_13,
};

type YamlVersion = keyof typeof versionSyntaxInfo;

interface ParseOptions {
  version?: YamlVersion;
}

const DEFAULT_OPTIONS = {
  version: '1.3',
} satisfies Required<ParseOptions>;

export function parseStream(text: string, options?: ParseOptions) {
  const combinedOptions = { ...DEFAULT_OPTIONS, ...options };

  const { grammar, rootProduction, nodeClasses } = versionSyntaxInfo[combinedOptions.version];

  const node = new ParseOperation(grammar, text).parseAll(rootProduction);

  return new AstToSerializationTree(nodeClasses).handleStream(text, node);
}
