import { readFileSync } from 'fs';

import { loadStream, dumpStream } from './lib';

export function roundtrip(filename: string) {
  console.log(filename);
  const text = readFileSync(filename, { encoding: 'utf-8' });

  process.stdout.write(dumpStream(loadStream(text)));
}
