import type { ParseEvent } from '..';

import { diff, type Difference } from '@/nodes/diff';
import type { SerializationNode } from '@/nodes';

import { parseStream } from '@/parser';
import { zip } from '@/util';

import { eventsToSerializationTrees } from '@/events';

export interface TestCase {
  id: string;

  name: string | undefined;
  from: string | undefined;
  tags: Set<string> | undefined;  
  fail: boolean;
  skip: boolean;

  yaml: string;
  tree: ParseEvent[] | undefined;
  json: string | undefined;
  dump: string | undefined;
  emit: string | undefined;
}

export interface TestResult {
  test: TestCase;
  inequal?: Difference<SerializationNode>[];
  error?: unknown;
}

export function runTest(test: TestCase) {
  function makeResult(status: string, rest: Partial<TestResult> = {}) {
    return {
      status,
      test,
      ...rest,
    };
  }

  if (test.skip) return makeResult('skipped');
  if (test.fail) return makeResult('skipped'); // TODO
  if (test.tree === undefined) return makeResult('skipped'); // TODO

  try {
    const expectedTree = Array.from(eventsToSerializationTrees(test.tree));
    const actualTree = Array.from(parseStream(test.yaml, { version: '1.3' }));

    const inequal = [] as Difference<SerializationNode>[];
    if (expectedTree.length !== actualTree.length) {
      console.error(expectedTree.length, actualTree.length);
      console.error(test.tree);
    }
    for (const [expectedDocument, actualDocument] of zip(
      expectedTree.slice(0, Math.min(expectedTree.length, actualTree.length)),
      actualTree.slice(0, Math.min(expectedTree.length, actualTree.length)),
    )) {
      inequal.push(...diff(expectedDocument, actualDocument));
    }
    const status = inequal.length > 0 ? 'failure' : 'success';
    return makeResult(status, { inequal });
  } catch (error) {
    return makeResult('error', { error });
  }
}
