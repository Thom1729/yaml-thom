import { loadText } from '..';
import { parseStream } from '@/parser';
import { compose } from '@/composer';
import {
  RepresentationMapping,
  SerializationNode,
} from '@/nodes';

import { extractMapEntries, extractStringMap } from '@/evaluator/helpers';

function loadAnnotationTest(name: string) {
  const inputText = loadText('evaluate', 'annotations', `${name}.yaml`);
  const test = compose(Array.from(parseStream(inputText))[0]);
  const testProperties = extractStringMap(test, ['context?', 'input', 'expected']);

  return {
    name,
    input: testProperties.input,
    expected: testProperties.expected,
    context: testProperties.context ? extractMapEntries(testProperties.context) : [],
  };
}

//////////

import { evaluate } from '@/evaluator';
import { prettyPrint } from '../prettyPrint';
import { diffSerializations } from '@/nodes/diff';

const [, , testName] = process.argv;

const { input, expected, context } = loadAnnotationTest(testName);

const result = evaluate(input, new RepresentationMapping('tag:yaml.org,2002:map', context));

const diffs = diffSerializations(result as SerializationNode, expected as SerializationNode);

for (const { path, actual, expected, message} of diffs) {
  console.log(`${path}: ${message}`);
  console.log('Actual');
  prettyPrint((s: string) => process.stdout.write(s), actual);
  console.log('Expected');
  prettyPrint((s: string) => process.stdout.write(s), expected);
}
