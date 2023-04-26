import { regexp } from './regexp';

describe(regexp, () => {
  test('empty', () => {
    const r = regexp``;
    expect(r.source).toBe(`(?:)`);
  });

  test('simple', () => {
    const r = regexp`a`;
    expect(r.source).toBe(`a`);
  });

  test('multiline', () => {
    const r = regexp`
      a
      b
      c
    `;
    expect(r.source).toBe('abc');
  });

  test('spaces', () => {
    const r = regexp`
      a\ b c
    `;
    expect(r.source).toBe('a bc');
  });

  test('comments', () => {
    const r = regexp`
      a \# b # c
    `;
    expect(r.source).toBe('a#b');
  });

  test('backtick', () => {
    const r = regexp`
      a\`b
    `;
    expect(r.source).toBe('a`b');
  });

  test('embedded string', () => {
    const r = regexp`
      a ${'b c'}
    `;
    expect(r.source).toBe('abc');
  });

  test('embedded regexp', () => {
    const r = regexp`
      a ${/b c/}
    `;
    expect(r.source).toBe('a(?:b c)');
  });
});
