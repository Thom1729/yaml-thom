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
  a: SerializationNode,
  b: SerializationNode,
  path: PathEntry[] = [],
): Generator<Difference> {
  function difference(message: string) {
    return { path, expected: a, actual: b, message };
  }

  if (a.kind !== b.kind) {
    yield difference('KIND');
  } else if (a.kind === 'alias') {
    if (a.alias !== (b as Alias).alias) yield difference('ALIAS');
  } else {
    if (a.tag !== (b as SerializationValueNode).tag) {
      yield difference('TAG');
    } if (a.anchor !== (b as SerializationValueNode).anchor) {
      yield difference('ANCHOR');
    } else if (a.kind === 'scalar') {
      if (a.content !== (b as SerializationScalar).content) yield difference('CONTENT');
    } else if (a.kind === 'sequence') {
      if (a.size !== (b as SerializationSequence).size) {
        yield difference('SIZE');
      } else {
        let i = 0;
        for (const [aChild, bChild] of zip(a, b as SerializationSequence)) {
          yield* diffSerializations(aChild, bChild, [...path, i]);
          i++;
        }
      }
    } else {
      if (a.size !== (b as SerializationMapping).size) {
        yield difference('SIZE');
      } else {
        for (const [[aKey, aValue], [bKey, bValue]] of zip(a, (b as SerializationMapping))) {
          yield* diffSerializations(aKey, bKey, [...path, null]);
          yield* diffSerializations(aValue, bValue, [...path, aKey]);
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
