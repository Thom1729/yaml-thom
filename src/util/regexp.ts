export interface TypedRegExp<T extends string> extends RegExp {
  exec(string: string): TypedRegExpExecArray<T> | null;
}

export interface TypedRegExpExecArray<T extends string> extends RegExpExecArray {
  groups: {
    [key in T]: string
  }
}

type TemplateStrings = Parameters<typeof String.raw>[0];

function *interleave<T>(a: ArrayLike<T>, b: ArrayLike<T>) {
  if (a.length !== b.length + 1) throw new TypeError();

  let i;
  for (i = 0; i < b.length; i++) {
    yield a[i];
    yield b[i];
  }
  yield a[i];
}

export function regexp(strings: TemplateStrings, ...args: (string | RegExp)[]) {
  const parts: string[] = [];

  for (const part of interleave(strings.raw, args)) {
    if (typeof part === 'string') {
      parts.push(part.replace(/\\.|#.*?$|./gms, s => {
        if (s === ' ' || s === '\n' || s.startsWith('#')) {
          return '';
        } else if (s === '\\#' || s === '\\ ' || s === '\\`') {
          return s.slice(1);
        } else {
          return s;
        }
      }));
    } else {
      // TODO throw if flags are incompatible
      parts.push(`(?:${part.source})`);
    }
  }

  return new RegExp(parts.join(''), 'gu');
}
