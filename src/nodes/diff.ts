import type {
  Alias,
  SerializationMapping,
  SerializationNode,
  SerializationScalar,
  SerializationSequence,
  SerializationValueNode,

  RepresentationNode,
  RepresentationScalar,
  RepresentationSequence,
  RepresentationMapping,
} from '.';

import { enumerate, zip } from '@/util';

export type PathEntry<T = RepresentationNode> =
| { type: 'index', index: number }
| { type: 'key', key: T }
| { type: 'value', key: T };

export interface Difference<T> {
  path: PathEntry<T>[];
  expected: T;
  actual: T;
  message: string;
}

export function diff(
  expected: SerializationNode,
  actual: SerializationNode,
): Generator<Difference<SerializationNode>>;

export function diff(
  expected: RepresentationNode,
  actual: RepresentationNode,
): Generator<Difference<RepresentationNode>>;

export function *diff(
  expected: SerializationNode | RepresentationNode,
  actual: SerializationNode | RepresentationNode,
) {
  yield* _diff(expected, actual, []);

  // TODO handle cycles

  function *_diff(
    expected: SerializationNode | RepresentationNode,
    actual: SerializationNode | RepresentationNode,
    path: PathEntry<SerializationNode | RepresentationNode>[],
  ): Generator<Difference<SerializationNode | RepresentationNode>> {
    function difference(message: string) {
      return { path, expected, actual, message };
    }

    if (expected.kind !== actual.kind) {
      yield difference('KIND');
    } else if (expected.kind === 'alias') {
      if (expected.alias !== (actual as Alias).alias) yield difference('ALIAS');
    } else {
      if (expected.tag !== (actual as RepresentationNode | SerializationValueNode).tag) {
        yield difference('TAG');
      } if ((expected as SerializationValueNode).anchor !== (actual as SerializationValueNode).anchor) {
        yield difference('ANCHOR');
      } else if (expected.kind === 'scalar') {
        if (expected.content !== (actual as SerializationScalar | RepresentationScalar).content) yield difference('CONTENT');
      } else if (expected.kind === 'sequence') {
        if (expected.size !== (actual as SerializationSequence).size) {
          yield difference('SIZE');
        } else {
          for (const [i, [expectedChild, actualChild]] of enumerate(zip(expected, actual as SerializationSequence | RepresentationSequence))) {
            yield* _diff(expectedChild, actualChild, [...path, { type: 'index', index: i }]);
          }
        }
      } else {
        if (expected.size !== (actual as SerializationMapping | RepresentationMapping).size) {
          yield difference('SIZE');
        } else {
          for (const [[expectedKey, actualKey], [bKey, bValue]] of zip(expected, (actual as SerializationMapping | RepresentationMapping))) {
            yield* _diff(expectedKey, bKey, [...path, { type: 'key', key: expectedKey }]);
            yield* _diff(actualKey, bValue, [...path, { type: 'value', key: expectedKey }]);
          }
        }
      }
    }
  }
}
