import type {
  Alias,
  SerializationMapping,
  SerializationNode,
  SerializationScalar,
  SerializationSequence,
  SerializationValueNode,
}  from '.';

import { present } from '@/presenter';

import { zip } from '@/util';

type PathEntry =
| number
| null
| SerializationNode;

export interface Difference {
  path: PathEntry[];
  expected: SerializationNode;
  actual: SerializationNode;
  message: string;
}

export function *diffSerializations(
  expected: SerializationNode,
  actual: SerializationNode,
  path: PathEntry[] = [],
): Generator<Difference> {
  function difference(message: string) {
    return { path, expected, actual, message };
  }

  if (expected.kind !== actual.kind) {
    yield difference('KIND');
  } else if (expected.kind === 'alias') {
    if (expected.alias !== (actual as Alias).alias) yield difference('ALIAS');
  } else {
    if (expected.tag !== (actual as SerializationValueNode).tag) {
      yield difference('TAG');
    } if (expected.anchor !== (actual as SerializationValueNode).anchor) {
      yield difference('ANCHOR');
    } else if (expected.kind === 'scalar') {
      if (expected.content !== (actual as SerializationScalar).content) yield difference('CONTENT');
    } else if (expected.kind === 'sequence') {
      if (expected.size !== (actual as SerializationSequence).size) {
        yield difference('SIZE');
      } else {
        let i = 0;
        for (const [expectedChild, actualChild] of zip(expected, actual as SerializationSequence)) {
          yield* diffSerializations(expectedChild, actualChild, [...path, i]);
          i++;
        }
      }
    } else {
      if (expected.size !== (actual as SerializationMapping).size) {
        yield difference('SIZE');
      } else {
        for (const [[expectedKey, actualKey], [bKey, bValue]] of zip(expected, (actual as SerializationMapping))) {
          yield* diffSerializations(expectedKey, bKey, [...path, null]);
          yield* diffSerializations(actualKey, bValue, [...path, expectedKey]);
        }
      }
    }
  }
}

export function pathToString(path: PathEntry[]) {
  return '/' + path
    .map(entry => {
      if (entry === null) {
        return 'key';
      } else if (typeof entry === 'number') {
        return entry;
      } else {
        return present(entry);
      }
    })
    .join('/');
}
