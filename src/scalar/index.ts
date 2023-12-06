const DOUBLE_QUOTE_ESCAPES: [number, string][] = [
  [0x00, '0'],
  [0x07, 'a'],
  [0x08, 'b'],
  [0x09, '\t'],
  [0x09, 't'],
  [0x0a, 'n'],
  [0x0b, 'v'],
  [0x0c, 'f'],
  [0x0d, 'r'],
  [0x1b, 'e'],
  [0x20, ' '],
  [0x22, '"'],
  [0x2f, '/'],
  [0x5c, '\\'],
  [0x85, 'N'], // next line
  [0xa0, '_'], // non-breaking space
  [0x2028, 'L'], // line separator
  [0x2029, 'P'], // paragraph separator
];

export const CODEPOINT_TO_ESCAPE = new Map(DOUBLE_QUOTE_ESCAPES);
export const ESCAPE_TO_CODEPOINT = new Map(DOUBLE_QUOTE_ESCAPES.map(([codepoint, escape]) => [escape, codepoint]));

export function isDoubleSafe(codepoint: number) {
  return codepoint >= 0x20 && codepoint !== 0x09 && codepoint !== 0x5c && codepoint !== 0x22;
}
