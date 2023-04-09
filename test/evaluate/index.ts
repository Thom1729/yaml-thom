import { loadText } from '..';
import { parseStream } from '@/parser';
import { compose } from '@/composer';
import {
  RepresentationMapping,
  SerializationNode,
} from '@/nodes';

import { isStr, isMap } from '@/evaluator/helpers';

function loadAnnotationTest(name: string) {
  const inputText = loadText('evaluate', 'annotations', `${name}.yaml`);
  const test = compose(Array.from(parseStream(inputText))[0]);

  if (!isMap(test)) throw new TypeError(`Expected map, got ${test.kind} tagged ${test.tag}`);

  const testProperties = strictFromEntries(Array.from(test).map(([key, value]) => {
    if (!isStr(key)) throw new TypeError(`meta key is not string`);
    if (key.content !== 'context' && key.content !== 'input'  && key.content !== 'expected') {
      throw new TypeError(`unexpected key ${key.content}`);
    }

    return [key.content, value] as const;
  }));

  let context;
  if (testProperties.context !== undefined) {
    if (!isMap(testProperties.context)) throw new TypeError(`context must be map`);
    context = testProperties.context;
  } else {
    context = new RepresentationMapping('tag:yaml.org,2002:map', []);
  }

  return {
    name,
    test: testProperties.input,
    expected: testProperties.expected,
    context,
  };
}

//////////

import { evaluate } from '@/evaluator';
import { prettyPrint } from '../prettyPrint';
import { diffSerializations } from '@/nodes/diff';
import { strictFromEntries } from '@/util';

const [, , testName] = process.argv;

const { test, expected, context } = loadAnnotationTest(testName);


const result = evaluate(test, context);

const diffs = diffSerializations(result as SerializationNode, expected as SerializationNode);

for (const { path, actual, expected, message} of diffs) {
  console.log(`${path}: ${message}`);
  console.log('Actual');
  prettyPrint((s: string) => process.stdout.write(s), actual);
  console.log('Expected');
  prettyPrint((s: string) => process.stdout.write(s), expected);
}
