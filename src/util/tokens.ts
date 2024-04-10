export type Tokens = Iterable<
  | string // A literal string
  | number // A number of indents
  | null   // A soft space
>;

import { repeat } from './string';

export function *stringifyTokens(itr: Tokens, indent: string = ' '): Iterable<string> {
  let isSpaced = true;
  let spaceRequested = false;
  for (const token of itr) {
    if (token === null) {
      spaceRequested = !isSpaced;
    } else if (typeof token === 'number') {
      if (token > 0) {
        yield repeat(token, indent);
        isSpaced = true;
      }
    } else {
      if (token.length > 0) {
        if (spaceRequested) {
          if (!isSpaced && token[0] !== ' ' && token[0] !== '\n') {
            yield ' ';
          }
          spaceRequested = false;
        }
        yield token;

        const lastChar = token[token.length - 1];
        isSpaced = !(lastChar !== ' ' && lastChar !== '\n');
      }
    }
  }
}
