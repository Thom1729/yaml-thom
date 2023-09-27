import path from 'path';
import fs from 'fs';
import { ParseEvent, parseEvent } from '@/events';

export interface TestCase {
  id: string;

  name: string | undefined;
  from: string | undefined;
  tags: Set<string> | undefined;  
  fail: boolean;
  skip: boolean;

  yaml: string;
  // tree: string | undefined;
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

export class DirectoryTestLoader {
  readonly basePath: string;

  constructor(basePath: string) {
    this.basePath = basePath;
  }

  loadTest(name: string): TestCase[] {
    return this.loadTestDirectory(name, path.join(this.basePath, name));
  }

  private loadTestDirectory(id: string, directoryPath: string): TestCase[] {
    const files = fs.readdirSync(directoryPath);
    if (fs.lstatSync(path.join(directoryPath, files[0])).isDirectory()) {
      return files.flatMap(f => this.loadTestDirectory(`${id} ${f}`, path.join(directoryPath, f)));
    } else {
      const {
        name,
        emit,
        json,
        yaml,
        dump,
        tree,
        error,
      } = Object.fromEntries(
        files
          .filter(filename => {
            // if (DIRECTORY_TEST_FILE_NAMES.hasOwnProperty(filename)) {
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
      ) as {
        [K in (typeof DIRECTORY_TEST_FILE_NAMES)[keyof typeof DIRECTORY_TEST_FILE_NAMES]]:
          string | undefined
      };
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
      return [x];
    }
  }

  listTests() {
    return fs.readdirSync(path.join(this.basePath))
      .filter(filename => filename === filename.toUpperCase());
  }
}
