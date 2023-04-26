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
