import { ChompingBehavior } from './ast';

import {
  repeat,
  charForCodePoint,
  combineSurrogates,
  parseHex,
  regexp,
} from '@/util';

function countEmptyLines(lines: string[]) {
  const ret = [];
  let count = 0;

  for (const line of lines) {
    if (line === '') {
      count++;
    } else {
      ret.push([count, line] as const);
      count = 1;
    }
  }

  return [ret, count] as const;
}

function emptyLines(x: number) {
  if (x > 1) {
    return repeat(x - 1, '\n');
  } else if (x === 1) {
    return ' ';
  } else {
    return '';
  }
}

function combineFlowLines(lines: string[]) {
  const [pairs, trailing] = countEmptyLines(lines);

  return pairs.flatMap(([x, line]) => [emptyLines(x), line]).join('') + emptyLines(trailing-1);
}

export function handlePlainScalarContent(content: string) {
  const trimmedLines = content
    .split('\n')
    .map(line => line.trim());

  return combineFlowLines(trimmedLines);
}

export function handleSingleQuotedScalarContent(content: string) {
  const trimmedLines = content
    .replace(/''/g, '\'')
    .split('\n')
    .map((line, i, lines) => {
      if (i !== 0) line = line.trimStart();
      if (i !== lines.length - 1) line = line.trimEnd();
      return line;
    });

  return combineFlowLines(trimmedLines);
}

export function handleDoubleQuotedScalarContent(content: string) {
  const trimmedLines = content
    .replace(/\\\n */g, '') // Line continuations (TODO?)
    .replace(/\\./g, s => (s === '\\\t' ? '\\t' : s)) // Hack to fix escaped tabs
    .split('\n')
    .map((line, i, lines) => {
      if (i !== 0) line = line.trimStart();
      if (i !== lines.length - 1) line = line.trimEnd();
      return line;
    })
    .map(handleDoubleEscapes);

  return combineFlowLines(trimmedLines);
}

export function handleBlockScalarContent(
  content: string,
  folded: boolean,
  baseIndentation: number,
  chompingBehavior: ChompingBehavior,
  indentationIndicator: number | null,
) {
  const lines = content.split('\n');
  if (lines[lines.length - 1] === '') lines.pop();

  let indentation = 0;
  if (indentationIndicator !== null) {
    indentation = baseIndentation + indentationIndicator;
  } else {
    for (const line of lines) {
      const trimmedLength = trimLeadingSpaces(line).length;
      if (trimmedLength === 0) {
        indentation = Math.max(indentation, line.length);
      } else {
        indentation = line.length - trimmedLength;
        break;
      }
    }
  }

  const commentLineIndex = lines.findIndex(line => line.slice(0, indentation).trimStart().length > 0);
  if (commentLineIndex !== -1) {
    lines.splice(commentLineIndex, Infinity);
  }

  const trimmedLines = lines.map(line => line.slice(indentation));
  
  // console.log({ content, lines, trimmedLines, indentation });

  const [pairs, trailing] = countEmptyLines(trimmedLines);

  // console.log({ pairs, trailing });

  let ret = '';
  if (folded) {
    let foldNext = false;
    for (const [count, line] of pairs) {
      if (line[0] === ' ' || line[0] === '\t') {
        foldNext = false;
        ret += repeat(count, '\n');
      } else if (!foldNext) {
        foldNext = true;
        ret += repeat(count, '\n');
      } else {
        ret += (repeat(count - 1, '\n') || ' ');
      }
      ret += line;
    }
  } else {
    for (const [count, line] of pairs) {
      ret += repeat(count, '\n');
      ret += line;
    }
  }

  if (chompingBehavior === 'STRIP') {
    // pass
  } else if (chompingBehavior === 'CLIP') {
    // TODO: Maybe should be (pairs.length > 0 && trailing > 0) || trailing > 1
    if (pairs.length > 0 && trailing > 0) {
      ret += '\n';
    }
  } else { // KEEP
    ret += repeat(trailing, '\n');
  }

  return ret;
}

////////////////////////////////////////

const DOUBLE_ESCAPE_EXPR = regexp`
  \\ (?:
      u [Dd][89AaBb]\p{Hex_Digit}{2}
      \\u [Dd][CcDdEeFf]\p{Hex_Digit}{2}
    | x \p{Hex_Digit}{0,2}
    | u \p{Hex_Digit}{0,4}
    | U \p{Hex_Digit}{0,8}
    | .
    | $
  )
`;

const DOUBLE_QUOTE_ESCAPES: { [k in string]?: string } = {
  '0': '\0', // Null
  a: '\x07', // Bell
  b: '\x08', // Backspace
  t: '\t', // Tab
  // '\t': '\t', // Tab
  n: '\n', // Line feed
  v: '\v', // Vertical tab
  f: '\f', // Form feed
  r: '\r', // Carriage return
  e: '\x1b', // Escape
  ' ': ' ', // Space
  '"': '"', // Double quote
  '/': '/',
  '\\': '\\',
  N: '\x85', // Next line
  _: '\xa0', // Non-breaking space
  L: '\u2028', // Line separator
  P: '\u2029', // Paragraph separator
};

function charForHexEscape(escape: string, length: number) {
  if (escape.length === length + 2) {
    const codePoint = parseHex(escape.slice(2));
    return charForCodePoint(codePoint);
  } else {
    throw new Error(`Expected ${length} hex digits after \\${escape[0]}`);
  }
}

export function handleDoubleEscapes(raw: string) {
  return raw.replace(DOUBLE_ESCAPE_EXPR, escape => {
    if (escape.length === 12) {
      const high = parseHex(escape.slice(2, 6));
      const low = parseHex(escape.slice(8, 12));
      const codePoint = combineSurrogates(high, low);
      return charForCodePoint(codePoint);
    }

    const c = escape[1];
    if (escape === '\\') {
      return '';
    } else if (c === 'x') {
      return charForHexEscape(escape, 2);
    } else if (c === 'u') {
      return charForHexEscape(escape, 4);
    } else if (c === 'U') {
      return charForHexEscape(escape, 8);
    } else {
      const result = DOUBLE_QUOTE_ESCAPES[c];
      if (result === undefined) {
        throw new Error(`Invalid character escape ${JSON.stringify(escape)}`);
      } else {
        return result;
      }
    }
  });
}

function trimLeadingSpaces(s: string) {
  return s.replace(/^ +/, '');
}
