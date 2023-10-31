import type { Mark } from './core/ast';
import { splitStream } from './splitStream';

function trimmedLines(...args: Parameters<typeof String.raw>) {
  const raw = String.raw(...args);
  const lines = raw.split(/^/gm);

  if (lines[0] === '\n') lines.shift();
  if (lines.length === 0) return [];

  const match = lines[0].match(/^ */);
  if (match === null) throw new TypeError();
  const n = match[0].length;

  const ret: string[] = lines.map(line => line.slice(n));
  if (ret.length > 1 && ret[ret.length - 1].length === 0) ret.pop();
  return ret;
}

describe(splitStream, () => {
  function foo(
    lines: string[],
    expected: readonly [Mark, Mark][],
  ) {
    const actual = Array.from(splitStream(lines[Symbol.iterator]()));
    expect(actual).toStrictEqual(expected);
  }

  test('empty', () => {
    foo(trimmedLines``, []);
  });

  test('comments only', () => {
    foo(trimmedLines`
      # nothing to see here
    `, []);
  });

  test('two documents', () => {
    foo(trimmedLines`
      hello
      ...
      goodbye
      ...
      # not a document
    `, [
      [
        { index: 0, row: 0, column: 0 },
        { index: 10, row: 2, column: 0 },
      ],
      [
        { index: 10, row: 2, column: 0 },
        { index: 22, row: 4, column: 0 },
      ],
    ]);
  });

  test('directives, no body', () => {
    foo(trimmedLines`
      %hello
      ...
      # not a document
    `, [
      [
        { index: 0, row: 0, column: 0 },
        { index: 11, row: 2, column: 0 },
      ],
    ]);
  });

  test('directives, body', () => {
    foo(trimmedLines`
      %hello
      ---
      world!
      ...
      # not a document
    `, [
      [
        { index: 0, row: 0, column: 0 },
        { index: 22, row: 4, column: 0 },
      ],
    ]);
  });

  test('two documents, no end marker', () => {
    foo(trimmedLines`
      hello
      ---
      world
      ...
      # not a document
    `, [
      [
        { index: 0, row: 0, column: 0 },
        { index: 6, row: 1, column: 0 },
      ],
      [
        { index: 6, row: 1, column: 0 },
        { index: 20, row: 4, column: 0 },
      ],
    ]);
  });
});
