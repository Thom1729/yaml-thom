import { splitStream, type SplitStreamResult } from './splitStream';

function *trimmedLines(...args: Parameters<typeof String.raw>) {
  const raw = String.raw(...args);
  const lines = raw.split(/^/gm);

  if (lines[0] === '\n') lines.shift();
  if (lines.length === 0) return;

  const match = lines[0].match(/^ */);
  if (match === null) throw new TypeError();
  const n = match[0].length;

  for (const line of lines) {
    yield line.slice(n);
  }
}

describe(splitStream, () => {
  function foo(
    lines: Iterator<string>,
    expected: readonly SplitStreamResult[],
  ) {
    const actual = Array.from(splitStream(lines));
    expect(actual).toStrictEqual(expected);
  }

  test('empty', () => {
    foo(trimmedLines``, [
      { start: 0, end: 0 },
    ]);
  });

  test('comments only', () => {
    foo(trimmedLines`# nothing to see here\n`, [
      { start: 0, end: 1 },
    ]);
  });

  test('two documents', () => {
    foo(trimmedLines`
      hello
      ...
      goodbye
      ...
      # not a document
    `, [
      { start: 0, end: 2 },
      { start: 2, end: 4 },
    ]);
  });

  test('directives, no body', () => {
    foo(trimmedLines`
      %hello
      ...
      # not a document
    `, [
      { start: 0, end: 2 },
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
      { start: 0, end: 4 },
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
      { start: 0, end: 1 },
      { start: 1, end: 4 },
    ]);
  });
});
