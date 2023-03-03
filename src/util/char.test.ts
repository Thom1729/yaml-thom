import {
  assertCodePoint,
  charForCodePoint,
  charUtf16Width,
  combineSurrogates,
} from "./char";

describe(assertCodePoint, () => {
  test('Valid', () => {
    for (const validInput of [1, 0xFFFF, 0x10_FFFF]) {
      assertCodePoint(validInput);
    }
  });

  test('Not an integer', () => {
    for (const badInput of [Infinity, NaN, 1.5]) {
      expect(() => assertCodePoint(badInput)).toThrowError(TypeError);
    }
  });

  test('Out of range', () => {
    for (const badInput of [-1, 0x11_0000]) {
      expect(() => assertCodePoint(badInput)).toThrowError(RangeError);
    }
  });

  test('Surrogate', () => {
    for (const badInput of [0xD800, 0xDFFF]) {
      expect(() => assertCodePoint(badInput)).toThrowError(RangeError);
    }
  });
});

describe(charForCodePoint, () => {
  test('BMP character', () => {
    expect(charForCodePoint(0x41)).toBe('A');
  });

  test('Astral character', () => {
    expect(charForCodePoint(0x01_F602)).toBe('😂');
  });
});

describe(charUtf16Width, () => {
  test('BMP character', () => {
    expect(charUtf16Width(0)).toBe(1);
    expect(charUtf16Width(0xFFFF)).toBe(1);
  });

  test('Astral character', () => {
    expect(charUtf16Width(0x01_0000)).toBe(2);
    expect(charUtf16Width(0x10_0000)).toBe(2);
  });
});

describe(combineSurrogates, () => {
  test('', () => {
    expect(combineSurrogates(0xD801, 0xDC37)).toBe(0x01_0437);
  });
});
