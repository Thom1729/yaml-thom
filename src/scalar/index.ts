import type { CodePoint } from '@/util';

const JSON_DOUBLE_QUOTE_ESCAPES = [
  [0x08, 'b'],
  [0x09, 't'],
  [0x0a, 'n'],
  [0x0c, 'f'],
  [0x0d, 'r'],
  [0x22, '"'],
  [0x2f, '/'],
  [0x5c, '\\'],
] as [CodePoint, string][];

const DOUBLE_QUOTE_ESCAPES = [
  [0x09, '\t'],
  ...JSON_DOUBLE_QUOTE_ESCAPES,
  [0x00, '0'],
  [0x07, 'a'],
  [0x0b, 'v'],
  [0x1b, 'e'],
  [0x20, ' '],
  [0x2f, '/'],
  [0x85, 'N'], // next line
  [0xa0, '_'], // non-breaking space
  [0x2028, 'L'], // line separator
  [0x2029, 'P'], // paragraph separator
] as [CodePoint, string][];

export const CODEPOINT_TO_JSON_ESCAPE = new Map(JSON_DOUBLE_QUOTE_ESCAPES);
export const CODEPOINT_TO_ESCAPE = new Map(DOUBLE_QUOTE_ESCAPES);
export const ESCAPE_TO_CODEPOINT = new Map(DOUBLE_QUOTE_ESCAPES.map(([codepoint, escape]) => [escape, codepoint]));

export function isDoubleSafe(codepoint: CodePoint) {
  return codepoint === 0x09 /* tab */ || (
    codepoint >= 0x20 /* control characters */ &&
    codepoint !== 0x5c /* backslash*/ &&
    codepoint !== 0x22 /* double quote */
  );
}
