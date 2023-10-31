export { type AstNode } from './core/ast';

import { parseAll } from './core/parser';
import { normalizeAst } from './core/normalizeAst';
import { splitStream } from './splitStream';
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
  return parseAll(lines, { index: 0, row: 0, column: 0 }, lines.length, grammar, rootProduction);
}

export function *parseStream(text: string, options?: ParseOptions) {
  const combinedOptions = { ...DEFAULT_OPTIONS, ...options };

  const { grammar, rootProduction, nodeClasses } = versions[combinedOptions.version];

  const lines = text.split(/^/gm);

  function nodeText(node: AstNode) {
    const [startMark, endMark] = node.range;
    if (startMark.row === endMark.row) {
      if (startMark.column === endMark.column) {
        return '';
      } else {
        return lines[startMark.row].slice(startMark.column, endMark.column);
      }
    } else {
      const ret: string[] = [];
      ret.push(lines[startMark.row].slice(startMark.column));
      for (let i = startMark.row + 1; i < endMark.row; i++) {
        ret.push(lines[i]);
      }
      if (endMark.column > 0) {
        ret.push(lines[endMark.row].slice(0, endMark.column));
      }
      return ret.join('');
    }
  }

  for (const [startMark, endMark] of splitStream(lines[Symbol.iterator]())) {
    const node = parseAll(lines, startMark, endMark.row, grammar, rootProduction);

    const normalized = single(normalizeAst(node, nodeClasses));

    yield* new AstToSerializationTree(nodeText).handleStream(normalized);
  }

  // const node = parseAll(lines, { index: 0, row: 0, column: 0 }, lines.length, grammar, rootProduction);

  // const normalized = single(normalizeAst(node, nodeClasses));

  // yield* new AstToSerializationTree(nodeText).handleStream(normalized);
}

export function parseSingleDocument(text: string, options?: ParseOptions) {
  return single(parseStream(text, options), 'Expected single document');
}
