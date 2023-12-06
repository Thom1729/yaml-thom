const UNICODE_MIN = 0;
const UNICODE_MAX = 0x10_FFFF;
const BMP_MAX = 0xFFFF;

const HIGH_SURROGATE_MIN = 0xD800;
const HIGH_SURROGATE_MAX = 0xDBFF;
const LOW_SURROGATE_MIN = 0xDC00;
const LOW_SURROGATE_MAX = 0xDFFF;

export type CodePoint = number & { '_codePointBrand': unknown };
export type HighSurrogate = number & { '_highSurrogateBrand': unknown };
export type LowSurrogate = number & { '_lowSurrogateBrand': unknown };

export function assertCodePoint(codePoint: number): asserts codePoint is CodePoint {
  if (!Number.isInteger(codePoint)) {
    throw new TypeError(`Code point ${codePoint} is not an integer`);
  } if (codePoint < UNICODE_MIN || codePoint > UNICODE_MAX) {
    throw new RangeError(`Code point ${codePoint.toString(16)} is outside the Unicode range`);
  } else if (codePoint >= HIGH_SURROGATE_MIN && codePoint <= LOW_SURROGATE_MAX) {
    throw new RangeError(`Code point ${codePoint.toString(16)} is a surrogate`);
  }
}

export function charForCodePoint(codePoint: CodePoint) {
  return String.fromCodePoint(codePoint);
}

export function isBmp(codePoint: CodePoint) {
  return codePoint <= BMP_MAX;
}

export function isAstral(codePoint: CodePoint) {
  return codePoint > BMP_MAX;
}

export function charUtf16Width(codePoint: CodePoint) {
  return (codePoint > BMP_MAX ? 2 : 1);
}

export function assertHighSurrogate(n: number): asserts n is HighSurrogate {
  if (n < HIGH_SURROGATE_MIN || n > HIGH_SURROGATE_MAX) throw new TypeError(`${n} is not a high surrogate`);
}

export function assertLowSurrogate(n: number): asserts n is LowSurrogate {
  if (n < LOW_SURROGATE_MIN || n > LOW_SURROGATE_MAX) throw new TypeError(`${n} is not a low surrogate`);
}

export function splitSurrogates(codepoint: CodePoint): [HighSurrogate, LowSurrogate] {
  if (!isAstral(codepoint)) throw new TypeError(`Code point ${codepoint} is not astral`);
  return [
    ((codepoint & 0xffff) >> 10) + HIGH_SURROGATE_MIN as HighSurrogate,
    (codepoint & 0x03ff) + LOW_SURROGATE_MIN as LowSurrogate,
  ];
}

export function combineSurrogates(high: HighSurrogate, low: LowSurrogate) {
  return (0x1_0000 | ((high - HIGH_SURROGATE_MIN) << 10) | (low - LOW_SURROGATE_MIN)) as CodePoint;
}
