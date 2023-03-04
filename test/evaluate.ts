import * as path from 'path';
import * as fs from 'fs';

import { parseStream } from '@/parser';
import { compose } from '@/composer';
import {
  RepresentationMapping,
  type RepresentationNode,
} from '@/nodes';

import { isStr, isMap, isNull } from '@/evaluator/helpers';

function parseMeta(meta: RepresentationNode) {
  let context = null;
  if (isNull(meta)) {
    // pass
  } else if (isMap(meta)) {
    for (const [key, value] of meta) {
      if (!isStr(key)) throw new TypeError(`meta key is not string`);

      if (key.content === 'context') {
        if (!isMap(value)) throw new TypeError(`Expected context to be map`);

        context = value;
      } else {
        throw new TypeError(`unknown meta key ${key.content}`);
      }
    }
  } else {
    throw new TypeError(`meta is ${meta.kind}<${meta.tag}>`);
  }
  return {
    context,
  };
}

function loadAnnotationTest(name: string) {
  const inputPath = path.join(__dirname, `cases/annotations/${name}.yaml`);
  const inputText = fs.readFileSync(inputPath, { encoding: 'utf-8' });

  const [meta, test, expected] = Array.from(parseStream(inputText)).map(compose);

  const { context } = parseMeta(meta);

  return {
    name,
    test,
    expected,
    context: context ?? new RepresentationMapping('', []),
  };
}

//////////

import { evaluate } from '@/evaluator';
import { prettyPrint } from './prettyPrint';
import { diffSerializations } from '@/common/diff';

const [, , testName] = process.argv;

const { test, expected, context } = loadAnnotationTest(testName);


const result = evaluate(test, context);

const diffs = diffSerializations(result, expected);

for (const { path, actual, expected, message} of diffs) {
  console.log(`${path}: ${message}`);
  console.log('Actual');
  prettyPrint(actual);
  console.log('Expected');
  prettyPrint(expected);
}
