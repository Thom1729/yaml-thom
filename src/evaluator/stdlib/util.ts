import type { RepresentationNode } from '@/nodes';
import type { AnnotationFunction } from '..';

export type Library = Partial<Record<string, AnnotationFunction>>;

export function assertNoArgs(args: readonly RepresentationNode[]) {
  if (args.length > 0) throw new TypeError('No arguments expected');
}
