import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

import { Logger } from './logger';

import { loadStream } from '@';

export const logger = new Logger(process.stdout);

export const BASE_PATH = path.join(fileURLToPath(import.meta.url), '..', '..');

export function readText(...path: string[]) {
  return fs.readFile(path.join(...path), { encoding: 'utf-8' });
}

export function writeText(filename: string, text: string) {
  return fs.writeFile(filename, text, { encoding: 'utf-8' });
}


export async function *readStream(filename: string | readonly string[]) {
  const computedFilename = Array.isArray(filename)
    ? path.join(...filename)
    : filename as string;

  try {
    const text = await fs.readFile(computedFilename, { encoding: 'utf-8' });
    for (const doc of loadStream(text)) {
      yield doc;
    }
  } catch (e) {
    throw new Error(`Failed to load ${computedFilename}`, { cause: e });
  }
}

export async function *loadTestFiles(p: string, testNames: string[]) {
  const baseDir = path.join(BASE_PATH, p);

  if (testNames.length === 0) {
    testNames = await fs.readdir(baseDir);
  }

  for (const name of testNames) {
    const fullName = name.endsWith('.yaml') ? name : name + '.yaml';
    const text = await readText(path.join(baseDir, fullName));
    yield {
      name: fullName,
      text,
    };
  }
}

export function *enumerate<T>(iterable: Iterable<T>, start: number = 0) {
  let i = start;
  for (const item of iterable) {
    yield [i++, item] as const;
  }
}

type Awaitable<T> = T | PromiseLike<T>;

export function command<T>(f: (args: T) => Awaitable<number | undefined | void>) {
  return async (args: T) => {
    const result = await f(args) as number | undefined;
    process.exit(result);
  };
}
