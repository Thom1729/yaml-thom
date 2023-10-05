import path from 'path';
import fs from 'fs';

import { parseEvent, type TestCase } from '../dist/esm/index.js';

const DIRECTORY_TEST_FILE_NAMES = {
  '===': 'name',
  'emit.yaml': 'emit',
  'in.json': 'json',
  'in.yaml': 'yaml',
  'out.yaml': 'dump',
  'test.event': 'tree',
  'error': 'error',
  'lex.token': 'tokens',
} as const;

function foo(files: Record<string, string>): TestCase {
  const {
    id,
    name,
    emit,
    json,
    yaml,
    dump,
    tree,
    error,
  } = files;
  if (yaml === undefined) {
    throw new Error(`yaml undefined`);
  }
  const x = {
    id,
    name: name?.trim(),
    emit,
    json,
    yaml,
    dump,
    tree: tree?.trimEnd()?.split('\n').map(parseEvent),
    fail: error !== undefined,

    from: undefined,
    tags: undefined,
    skip: false,
  };
  return x;
}

export class DirectoryTestLoader {
  readonly basePath: string;

  constructor(basePath: string) {
    this.basePath = basePath;
  }

  loadTest(name: string): Iterable<TestCase> {
    return this.loadTestDirectory(name, path.join(this.basePath, name));
  }

  private *loadTestDirectory(id: string, directoryPath: string): Iterable<TestCase> {
    const files = fs.readdirSync(directoryPath);
    if (fs.lstatSync(path.join(directoryPath, files[0])).isDirectory()) {
      for (const f of files) {
        yield* this.loadTestDirectory(`${id} ${f}`, path.join(directoryPath, f));
      }
    } else {
      const y = Object.fromEntries(
        files
          .filter(filename => {
            if (Object.hasOwn(DIRECTORY_TEST_FILE_NAMES, filename)) {
              return true;
            } else {
              console.error(`Unknown file ${path.join(directoryPath, filename)}`);
              return false;
            }
          })
          .map(filename => {
            return [
              DIRECTORY_TEST_FILE_NAMES[filename as keyof typeof DIRECTORY_TEST_FILE_NAMES],
              fs.readFileSync(path.join(directoryPath, filename), { encoding: 'utf-8' })
            ];
          }),
      );
      yield foo(y);
    }
  }

  listTests() {
    return fs.readdirSync(path.join(this.basePath))
      .filter(filename => filename === filename.toUpperCase());
  }
}
