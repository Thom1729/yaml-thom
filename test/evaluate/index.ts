import { loadText } from '..';
import { parseStream } from '@/parser';
import { compose } from '@/composer';
import {
  RepresentationMapping,
  type SerializationNode,
  type RepresentationNode,
} from '@/nodes';

import { evaluate } from '@/evaluator';
import { prettyPrint } from '../prettyPrint';
import { diffSerializations } from '@/nodes/diff';

import { extractMapEntries, extractStringMap } from '@/evaluator/helpers';

interface AnnotationTest {
  name: string;
  input: RepresentationNode;
  expected: RepresentationNode;
  context: readonly (readonly [RepresentationNode, RepresentationNode])[];
}

function loadAnnotationTest(name: string): AnnotationTest {
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

function runAnnotationTest({ context, input, expected }: AnnotationTest) {
  const result = evaluate(input, new RepresentationMapping('tag:yaml.org,2002:map', context));

  const diffs = Array.from(diffSerializations(result as SerializationNode, expected as SerializationNode));

  return { result, diffs };
}

//////////

import { Logger } from '../logger';

const logger = new Logger(process.stdout);

import path from 'path';
import fs from 'fs';

const allTests = fs.readdirSync(path.join(__dirname, 'annotations'))
  .filter(s => s.endsWith('.yaml'))
  .map(s => s.slice(0, -5));

const [, , ...testNames] = process.argv;

for (const testName of (testNames.length ? testNames : allTests)) {
  const test = loadAnnotationTest(testName);
  const result = runAnnotationTest(test);

  if (result.diffs.length) {
    logger.log(testName);
    logger.indented(() => {
      for (const { path, actual, expected, message} of result.diffs) {
        logger.log(`${path}: ${message}`);
        logger.log('Actual');
        prettyPrint(logger.write.bind(logger), actual);
        logger.log('Expected');
        prettyPrint(logger.write.bind(logger), expected);
      }
    });
  }
}
