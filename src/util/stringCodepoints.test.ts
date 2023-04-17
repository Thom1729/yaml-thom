import { cmpStringsByCodepoint, stringCodepointLength } from './stringCodepoints';

describe(cmpStringsByCodepoint, () => {
  const tests = [
    ['', '', 0],
    ['a', '', 1],
    ['', 'a', -1],
    ['a', 'b', -1],
    ['\uffff', '🐶', -1],
  ] as const;

  for (const [a, b, result] of tests) {
    test('', () => {
      expect(Math.sign(cmpStringsByCodepoint(a, b))).toBe(result);
    });
  }
});

describe(stringCodepointLength, () => {
  const tests = [
    ['', 0],
    ['a', 1],
    ['🐶', 1],
  ] as const;

  for (const [s, l] of tests) {
    test('', () => {
      expect(stringCodepointLength(s)).toBe(l);
    });
  }
});
