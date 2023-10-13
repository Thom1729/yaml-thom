import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

import { Logger } from './logger';

export const logger = new Logger(process.stdout);

export const BASE_PATH = path.join(fileURLToPath(import.meta.url), '..', '..');

export function readTextSync(...path: string[]) {
  return fs.readFileSync(path.join(...path), { encoding: 'utf-8' });
}

export function *loadTestFiles(p: string, testNames: string[]) {
  const baseDir = path.join(BASE_PATH, p);

  if (testNames.length === 0) {
    testNames = fs.readdirSync(baseDir);
  }

  for (const name of testNames) {
    const fullName = name.endsWith('.yaml') ? name : name + '.yaml';
    const text = readTextSync(path.join(baseDir, fullName));
    yield {
      name: fullName,
      text,
    };
  }
}
