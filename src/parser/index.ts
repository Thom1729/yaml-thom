export { type AstNode } from './core/ast';
import { parseAll } from './core/parser';

import { normalizeAst } from './core/normalizeAst';
import { splitStream } from './splitStream';
import { astToSerializationTree } from './core/astToSerializationTree';

import versions from './versions';
import { iterate, single } from '@/util';
import type { AstNode, Mark } from './core/ast';
import type { SerializationNode } from '@/nodes';

export type YamlVersion = keyof typeof versions;

export interface ParseOptions {
  version: YamlVersion;
}

const DEFAULT_OPTIONS = {
  version: '1.3',
} satisfies ParseOptions;

export function parseAst(text: string, version: YamlVersion) {
  const { grammar, rootProduction } = versions[version];

  const lines = text.split(/^/gm);
  return parseAll(lines, { index: 0, row: 0, column: 0 }, lines.length, grammar, rootProduction);
}

function _parseDocument(
  lines: readonly string[],
  version: YamlVersion,
  startMark: Mark,
  endMark: Mark,
) {
  const { grammar, rootProduction, nodeClasses } = versions[version];

  const node = parseAll(lines, startMark, endMark.row, grammar, rootProduction);

  const normalized = single(normalizeAst(node, nodeClasses));

  return single(astToSerializationTree(normalized, nodeText.bind(undefined, lines)));
}

export function *parseStream(
  text: string,
  options?: Partial<ParseOptions>,
): Iterable<SerializationNode> {
  const combinedOptions = { ...DEFAULT_OPTIONS, ...options };
  const lines = text.split(/^/gm);

  for (const [startMark, endMark] of splitStream(iterate(lines))) {
    yield _parseDocument(lines, combinedOptions.version, startMark, endMark);
  }

  // const node = parseAll(lines, { index: 0, row: 0, column: 0 }, lines.length, grammar, rootProduction);
  // const normalized = single(normalizeAst(node, nodeClasses));
  // yield* new AstToSerializationTree(nodeText).handleStream(normalized);
}

export function parseSingleDocument(
  text: string,
  options?: Partial<ParseOptions>,
): SerializationNode {
  const combinedOptions = { ...DEFAULT_OPTIONS, ...options };
  const lines = text.split(/^/gm);

  const [startMark, endMark] = single(splitStream(iterate(lines)));
  return _parseDocument(lines, combinedOptions.version, startMark, endMark);
}

function nodeText(lines: readonly string[], node: AstNode) {
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
