import {
  sorted,
  assertCodePoint,
  charUtf16Width,
} from '@/util';

function normalizeChar(char: number | string) {
  if (typeof char === 'number') {
    assertCodePoint(char);
    return char;
  } else {
    const codePoint = char.codePointAt(0);
    if (codePoint === undefined || char.length !== charUtf16Width(codePoint)) {
      throw new TypeError(`String was not a single character`);
    }
    return codePoint;
  }
}

export function normalizeRanges(args: (number | string | readonly [number | string, number | string])[]) {
  return sorted(args.map(arg => {
    if (Array.isArray(arg)) {
      return [normalizeChar(arg[0]), normalizeChar(arg[1])] as const;
    } else {
      const n = normalizeChar(arg as string | number);
      return [n, n] as const;
    }
  }), (a, b) => a[0] - b[0]);
}

export class CharSet {
  readonly ranges: readonly (readonly [number, number])[];

  constructor(...args: (number | string | readonly [number | string, number | string])[]) {
    this.ranges = normalizeRanges(args);
  }

  has(codepoint: number) {
    for (const [min, max] of this.ranges) {
      if (codepoint >= min && codepoint <= max) {
        return true;
      }
    }
    return false;
  }

  minus(other: CharSet) {
    const ret: [number, number][] = [];
    let otherIndex = 0;

    for (const [thisMin, thisMax] of this.ranges) {
      let min = thisMin;
      while (true) {
        const [otherMin, otherMax] = other.ranges[otherIndex] ?? [Infinity, Infinity];

        if (min > thisMax) {
          break;
        } else if (otherMin > thisMax) {
          ret.push([min, thisMax]);
          break;
        } else if (min > otherMax) {
          otherIndex++;
        } else {
          if (otherMin > min) {
            ret.push([min, otherMin - 1]);
          } else {
            otherIndex++;
          }
          min = otherMax + 1;
        }
      }
    }
    return new CharSet(...ret);
  }
}
