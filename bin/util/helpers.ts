import path from 'path';

import fs from 'fs/promises';

import { Logger } from './logger';
import { validationProvider } from './validators';
import { BASE_PATH } from './basePath';

import { loadStream, type LoadOptions, type Validator } from '@';

export const logger = new Logger(process.stdout);

function normalizeFilename(filename: string | readonly string[]) {
  if (typeof filename === 'string') {
    return filename;
  } else {
    return path.join(...filename);
  }
}

export function readText(filename: string | readonly string[]) {
  return fs.readFile(normalizeFilename(filename), { encoding: 'utf-8' });
}

export function writeText(filename: string | readonly string[], text: string) {
  return fs.writeFile(normalizeFilename(filename), text, { encoding: 'utf-8' });
}

export async function *readStream(
  filename: string | readonly string[],
  options: {
    load?: Partial<LoadOptions>,
    validator?: Validator,
  } = {},
) {
  const computedFilename = normalizeFilename(filename);
  const name = path.parse(computedFilename).name;

  try {
    const text = await fs.readFile(computedFilename, { encoding: 'utf-8' });
    for (const [index, document] of enumerate(loadStream(text, options.load), 1)) {
      if (options.validator !== undefined) {
        validationProvider.validate(options.validator, document);
      }
      yield {
        path: computedFilename,
        name,
        index,
        document,
      };
    }
  } catch (e) {
    throw new Error(`Failed to load ${name}`, { cause: e });
  }
}

export async function findTestFiles(
  directory: string | readonly string[],
  testNames: string[],
) {
  const baseDir = path.join(BASE_PATH, normalizeFilename(directory));

  if (testNames.length === 0) {
    return (await fs.readdir(baseDir))
      .filter(filename => filename.endsWith('.yaml'))
      .map(name => path.join(baseDir, name));
  } else {
    return testNames.map(name => path.join(baseDir, `${name}.yaml`));
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
