import * as path from 'path';
import * as fs from 'fs';

const PATH = path.join(__dirname, 'cases', 'test5.yaml');

const text = fs.readFileSync(PATH, { encoding: 'utf8' });

import { ParseOperation } from '../src/parser/parser';
import { astToSerializationTree } from '../src/parser/astToSerializationTree';

import { prettyPrint } from '../src/common/prettyPrint';
import { GRAMMAR } from '../src/parser/grammar';

import { Logger } from '../src/log';
const logger = new Logger(process.stdout);

const op = new ParseOperation(GRAMMAR, text);

// op.addListener('in', e => {
//   logger.log('>', e.displayName);
//   logger.level++;
// });
// op.addListener('out', e => {
//   logger.level--;
//   const sign = e.result ? '+' : '-';
//   logger.log(sign, e.displayName);
// });

op.addListener('out', e => {
  if (!e.result) return;
  if (!e.displayName.includes('scalar')) return;
  logger.log(e.displayName, JSON.stringify(text.slice(e.index, e.result[1])));
});

const parsed = op.parseAll('yaml-stream');

const serialization = astToSerializationTree(text, parsed);
for (const tree of serialization) {
  prettyPrint(tree);

  console.log(JSON.stringify(tree));
}
