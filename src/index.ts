import { parseSingleDocument, parseStream, type ParseOptions } from './parser';
import { compose, type ComposeOptions } from './composer';

export interface LoadOptions extends ParseOptions, ComposeOptions {}

export function *loadStream(text: string, options: LoadOptions = {}) {
  for (const serialization of parseStream(text, options)) {
    yield compose(serialization, options);
  }
}

export function loadSingleDocument(text: string, options: LoadOptions = {}) {
  return compose(parseSingleDocument(text, options), options);
}
