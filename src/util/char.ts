const UNICODE_MIN = 0;
const UNICODE_MAX = 0x10_FFFF;
const BMP_MAX = 0xFFFF;

const HIGH_SURROGATE_MIN = 0xD800;
const HIGH_SURROGATE_MAX = 0xDBFF;
const LOW_SURROGATE_MIN = 0xDC00;
const LOW_SURROGATE_MAX = 0xDFFF;

export function assertCodePoint(codePoint: number) {
  if (!Number.isInteger(codePoint)) {
    throw new TypeError(`Code point ${codePoint} is not an integer`);
  } if (codePoint < UNICODE_MIN || codePoint > UNICODE_MAX) {
    throw new RangeError(`Code point ${codePoint.toString(16)} is outside the Unicode range`);
  } else if (codePoint >= HIGH_SURROGATE_MIN && codePoint <= LOW_SURROGATE_MAX) {
    throw new RangeError(`Code point ${codePoint.toString(16)} is a surrogate`);
  }
}

export function charForCodePoint(codePoint: number) {
  assertCodePoint(codePoint);
  return String.fromCodePoint(codePoint);
}

export function charUtf16Width(codePoint: number) {
  assertCodePoint(codePoint);
  return (codePoint > BMP_MAX ? 2 : 1);
}

export function combineSurrogates(high: number, low: number) {
  return 0x1_0000 | ((high - HIGH_SURROGATE_MIN) << 10) | (low - LOW_SURROGATE_MIN);
}
