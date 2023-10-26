export { type AstNode } from './core/ast';

import { ParseOperation } from './core/parser';
import { normalizeAst } from './core/normalizeAst';
import { AstToSerializationTree } from './core/astToSerializationTree';

import versions from './versions';
import { single } from '@/util';

export type YamlVersion = keyof typeof versions;

export interface ParseOptions {
  version?: YamlVersion;
}

const DEFAULT_OPTIONS = {
  version: '1.3',
} satisfies Required<ParseOptions>;

export function parseAst(text: string, version: YamlVersion) {
  const { grammar, rootProduction } = versions[version];
  return new ParseOperation(grammar, text).parseAll(rootProduction);
}

export function parseStream(text: string, options?: ParseOptions) {
  const combinedOptions = { ...DEFAULT_OPTIONS, ...options };

  const { grammar, rootProduction, nodeClasses } = versions[combinedOptions.version];

  const node = new ParseOperation(grammar, text).parseAll(rootProduction);

  const normalized = Array.from(normalizeAst(node, nodeClasses));

  return new AstToSerializationTree(text).handleStream({
    name: 'stream',
    parameters: {},
    content: normalized,
    range: [0, 0],
  });
}

export function parseSingleDocument(text: string, options?: ParseOptions) {
  return single(parseStream(text, options), 'Expected single document');
}
