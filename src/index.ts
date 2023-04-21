import { parseSingleDocument, parseStream, type ParseOptions } from './parser';
import { compose, type ComposeOptions } from './composer';

import { serialize } from './serializer';
import { present } from './presenter';

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

export function dumpDocument(document: RepresentationNode): string {
  return present(serialize(document));
}
