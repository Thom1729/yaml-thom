import { readFileSync } from 'fs';

import { loadStream, dumpStream, evaluate, RepresentationMapping } from './lib';

export function evaluateStream(filename: string) {
  const text = readFileSync(filename, { encoding: 'utf-8' });

  const documents = Array.from(loadStream(text));

  const context = new RepresentationMapping('tag:yaml.org,2002:map', []);

  const evaluated = documents.map(d => evaluate(d, context));

  process.stdout.write(dumpStream(evaluated));
}
