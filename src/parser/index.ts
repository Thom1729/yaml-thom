export { type AstNode } from './core/ast';

import { parseAll } from './core/parser';
import { normalizeAst } from './core/normalizeAst';
import { AstToSerializationTree } from './core/astToSerializationTree';

import versions from './versions';
import { single } from '@/util';
import type { AstNode } from './core/ast';

export type YamlVersion = keyof typeof versions;

export interface ParseOptions {
  version?: YamlVersion;
}

const DEFAULT_OPTIONS = {
  version: '1.3',
} satisfies Required<ParseOptions>;

export function parseAst(text: string, version: YamlVersion) {
  const { grammar, rootProduction } = versions[version];

  const lines = text.split(/^/gm);
  return parseAll(lines, 0, lines.length, grammar, rootProduction);
}

export function parseStream(text: string, options?: ParseOptions) {
  const combinedOptions = { ...DEFAULT_OPTIONS, ...options };

  const { grammar, rootProduction, nodeClasses } = versions[combinedOptions.version];

  function nodeText(node: AstNode) {
    return text.slice(node.range[0].index, node.range[1].index);
  }

  const lines = text.split(/^/gm);

  const node = parseAll(lines, 0, lines.length, grammar, rootProduction);

  const normalized = single(normalizeAst(node, nodeClasses));

  return new AstToSerializationTree(nodeText).handleStream(normalized);
}

export function parseSingleDocument(text: string, options?: ParseOptions) {
  return single(parseStream(text, options), 'Expected single document');
}
