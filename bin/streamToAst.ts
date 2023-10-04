import { readFileSync } from 'fs';

import {
  parseAst,
  type YamlVersion,
  type AstNode,
} from '../dist/esm/index.js';

export function streamToAst(filename: string, version: YamlVersion) {
  const text = readFileSync(filename, { encoding: 'utf-8' });
  const ast = parseAst(text, version);

  prettyPrintAst(ast, 0);
}

export function repeat(count: number, s: string) {
  return new Array(count + 1).join(s);
}

function prettyPrintAst({ name, parameters, content }: AstNode, depth: number) {
  process.stdout.write(repeat(depth, '  '));
  process.stdout.write(name);

  const p = Object.entries(parameters);
  if (p.length) {
    process.stdout.write('(');
    process.stdout.write(p.map(([,v]) => v).join(','));
    process.stdout.write(')');
  }
  process.stdout.write('\n');

  for (const child of content) {
    prettyPrintAst(child, depth + 1);
  }
}
