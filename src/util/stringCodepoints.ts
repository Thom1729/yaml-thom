export function cmpStringsByCodepoint(a: string, b: string) {
  let i = 0, j = 0;
  while (true) {
    const aChar = a.codePointAt(i);
    const bChar = b.codePointAt(j);

    if (aChar === undefined && bChar === undefined) {
      return 0;
    } else if (aChar === undefined) {
      return -1;
    } else if (bChar === undefined) {
      return 1;
    }

    if (aChar !== bChar) return aChar - bChar;

    i += (aChar > 0xffff ? 2 : 1);
    j += (bChar > 0xffff ? 2 : 1);
  }
}

export function stringCodepointLength(s: string) {
  return Array.from(s).length;
}
