import { zip } from '@/util';

import type { RepresentationNode } from '.';

// TODO: Handle cycles, etc
export function equals(a: RepresentationNode, b: RepresentationNode) {
  if (a === b) return true;

  if (a.tag !== b.tag) return false;

  if (a.kind === 'scalar') {
    if (b.kind !== 'scalar') return false;
    if (a.content !== b.content) return false;
  } else if (a.kind === 'sequence') {
    if (b.kind !== 'sequence') return false;
    if (a.size !== b.size) return false;

    for (const [x, y] of zip(a, b)) {
      if (!equals(x, y)) return false;
    }
  } else if (a.kind === 'mapping') {
    if (b.kind !== 'mapping') return false;
    if (a.size !== b.size) return false;

    for (const [[aKey, aValue], [bKey, bValue]] of zip(a, b)) {
      if (!equals(aKey, bKey)) return false;
      if (!equals(aValue, bValue)) return false;
    }
  }

  return true;
}
