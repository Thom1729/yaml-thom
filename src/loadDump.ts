/**
 * @module Loading/Dumping
 */

import { parseSingleDocument, parseStream, type ParseOptions } from './parser';
import { compose, type ComposeOptions } from './composer';

import { SerializeOptions, serialize } from './serializer';
import { PresentOptions, present } from './presenter';

import type { RepresentationNode } from './nodes';

/**
 * @category Loading
 *
 * @description Load a YAML stream.
 */
export function *loadStream(text: string, options: Partial<LoadOptions> = {}): Iterable<RepresentationNode> {
  for (const serialization of parseStream(text, options)) {
    yield compose(serialization, options);
  }
}

/**
 * @category Loading
 */
export function loadSingleDocument(text: string, options: Partial<LoadOptions> = {}): RepresentationNode {
  return compose(parseSingleDocument(text, options), options);
}

/**
 * @category Loading
 */
export interface LoadOptions extends ParseOptions, ComposeOptions {}

/**
 * @category Dumping
 */
export function dumpDocument(document: RepresentationNode, options: Partial<DumpOptions> = {}): string {
  return present(serialize(document, options), options);
}

/**
 * @category Dumping
 */
export function dumpStream(documents: Iterable<RepresentationNode>, options: Partial<DumpOptions> = {}): string {
  return Array.from(documents)
    .map(document => present(serialize(document, options), options))
    .join('');
}

/**
 * @category Dumping
 */
export interface DumpOptions extends SerializeOptions, PresentOptions {}
