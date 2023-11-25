import { readFileSync } from 'fs';

import { loadStream, dumpStream } from '@/index';

export function roundtrip(filename: string) {
  const text = readFileSync(filename, { encoding: 'utf-8' });

  process.stdout.write(dumpStream(loadStream(text)));
}
