import type {
  RepresentationNode,
  RepresentationScalar,
  RepresentationSequence,
  RepresentationMapping,
} from './representationGraph';

import { enumerate, zip } from '@/util';

export type PathEntry =
| { type: 'index', index: number }
| { type: 'key', key: RepresentationNode }
| { type: 'value', key: RepresentationNode };

export interface Difference {
  path: PathEntry[];
  expected: RepresentationNode;
  actual: RepresentationNode;
  message: string;
}

export function *diff(
  expected: RepresentationNode,
  actual: RepresentationNode,
): Iterable<Difference> {
  yield* _diff(expected, actual, []);

  // TODO handle cycles

  function *_diff(
    expected: RepresentationNode,
    actual: RepresentationNode,
    path: PathEntry[],
  ): Iterable<Difference> {
    function difference(message: string) {
      return { path, expected, actual, message };
    }

    if (expected.kind !== actual.kind) {
      yield difference('KIND');
    } else if (expected.tag !== actual.tag) {
      yield difference('TAG');
    } else if (expected.kind === 'scalar') {
      if (expected.content !== (actual as RepresentationScalar).content) {
        yield difference('CONTENT');
      }
    } else if (expected.kind === 'sequence') {
      if (expected.size !== (actual as RepresentationSequence).size) {
        yield difference('SIZE');
      } else {
        for (const [index, [expectedChild, actualChild]] of enumerate(zip(expected, actual as RepresentationSequence))) {
          yield* _diff(expectedChild, actualChild, [...path, { type: 'index', index }]);
        }
      }
    } else {
      if (expected.size !== (actual as RepresentationMapping).size) {
        yield difference('SIZE');
      } else {
        for (const [[expectedKey, actualKey], [bKey, bValue]] of zip(expected, (actual as RepresentationMapping))) {
          yield* _diff(expectedKey, bKey, [...path, { type: 'key', key: expectedKey }]);
          yield* _diff(actualKey, bValue, [...path, { type: 'value', key: expectedKey }]);
        }
      }
    }
  }
}
