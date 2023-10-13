export * from './composer';
export * from './constructor';
export * from './evaluator';
export * from './events';
export * from './nodes';
export * from './parser';
export * from './presenter';
export * from './serializer';
export * from './testSuite';
export * from './validator';

import { parseSingleDocument, parseStream, type ParseOptions } from './parser';
import { compose, type ComposeOptions } from './composer';

import { SerializeOptions, serialize } from './serializer';
import { PresentOptions, present } from './presenter';

import type { RepresentationNode } from './nodes';

export interface LoadOptions extends ParseOptions, ComposeOptions {}

export function *loadStream(text: string, options: LoadOptions = {}): Generator<RepresentationNode> {
  for (const serialization of parseStream(text, options)) {
    yield compose(serialization, options);
  }
}

export function loadSingleDocument(text: string, options: LoadOptions = {}): RepresentationNode {
  return compose(parseSingleDocument(text, options), options);
}

export interface DumpOptions extends SerializeOptions, PresentOptions {}

export function dumpDocument(document: RepresentationNode, options: DumpOptions = {}): string {
  return present(serialize(document, options), options);
}

export function dumpStream(documents: Iterable<RepresentationNode>, options: DumpOptions = {}): string {
  return Array.from(documents)
    .map(document => present(serialize(document, options), options))
    .join('');
}
