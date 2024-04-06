import path from 'path';
import fs from 'fs/promises';

import { parseEvent, type ParseEvent } from '@/index';

export interface TestCase {
  id: string;

  name: string | undefined;
  from: string | undefined;
  tags: Set<string> | undefined;
  fail: boolean;
  skip: boolean;

  yaml: string;
  tree: ParseEvent[] | undefined;
  json: string | undefined;
  dump: string | undefined;
  emit: string | undefined;
}

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

function makeTestCase(id: string, files: Record<string, string>): TestCase {
  const {
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

  loadTest(name: string): AsyncIterable<TestCase> {
    return this.loadTestDirectory(name, path.join(this.basePath, name));
  }

  private async *loadTestDirectory(id: string, directoryPath: string): AsyncIterable<TestCase> {
    const files = await fs.readdir(directoryPath);
    if ((await fs.lstat(path.join(directoryPath, files[0]))).isDirectory()) {
      for (const f of files) {
        yield* this.loadTestDirectory(`${id} ${f}`, path.join(directoryPath, f));
      }
    } else {
      const y = Object.fromEntries(await Promise.all(
        files
          .filter(filename => {
            if (Object.hasOwn(DIRECTORY_TEST_FILE_NAMES, filename)) {
              return true;
            } else {
              console.error(`Unknown file ${path.join(directoryPath, filename)}`);
              return false;
            }
          })
          .map(async filename => {
            return [
              DIRECTORY_TEST_FILE_NAMES[filename as keyof typeof DIRECTORY_TEST_FILE_NAMES],
              await fs.readFile(path.join(directoryPath, filename), { encoding: 'utf-8' })
            ];
          }),
      ));
      yield makeTestCase(id, y);
    }
  }

  async listTests() {
    return (await fs.readdir(path.join(this.basePath)))
      .filter(filename => filename === filename.toUpperCase());
  }
}
