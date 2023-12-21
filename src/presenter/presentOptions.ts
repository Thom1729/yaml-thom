import {
  NonSpecificTag,
  ScalarStyle,

  type SerializationScalar,
} from '@/nodes';

import {
  isAstral, isBmp, splitSurrogates, type CodePoint,
  type Strategies, type StrategyOptions,
} from '@/util';

import {
  CODEPOINT_TO_ESCAPE, CODEPOINT_TO_JSON_ESCAPE,
  canBePlainScalar,
} from '@/scalar';

//////////

export const scalarStyleStrategies = {
  [ScalarStyle.plain]: (node: SerializationScalar) => canBePlainScalar(node.content) ? ScalarStyle.plain : undefined,
  [ScalarStyle.single]: () => undefined,
  [ScalarStyle.double]: (node: SerializationScalar) => node.tag !== NonSpecificTag.question ? ScalarStyle.double : undefined,
  [ScalarStyle.block]: () => undefined,
  [ScalarStyle.folded]: () => undefined,
} satisfies Strategies<ScalarStyle, [SerializationScalar]>;

//////////

export const doubleQuoteEscapeCharacters = {
  builtin: (codepoint: CodePoint) => CODEPOINT_TO_ESCAPE.has(codepoint) || undefined,
  'non-ascii': (codepoint: CodePoint) => codepoint <= 0x7f ? true : undefined,
  all: () => true,
} satisfies Strategies<boolean, [CodePoint]>;

//////////

function hex(codepoint: number, width: number) {
  return codepoint.toString(16).padStart(width, '0');
}

export const doubleQuoteEscapeStrategies = {
  builtin: (codepoint: CodePoint) => CODEPOINT_TO_ESCAPE.get(codepoint),
  json: (codepoint: CodePoint) => CODEPOINT_TO_JSON_ESCAPE.get(codepoint),
  x: (codepoint: CodePoint) => codepoint <= 0xff ? 'x' + hex(codepoint, 2) : undefined,
  u: (codepoint: CodePoint) => isBmp(codepoint) ? 'u' + hex(codepoint, 4) : undefined,
  U: (codepoint: CodePoint) => 'U' + hex(codepoint, 8),
  uu: (codepoint: CodePoint) => {
    if (isAstral(codepoint)) {
      const [high, low] = splitSurrogates(codepoint);
      return `u${hex(high, 4)}\\u${hex(low, 4)}`;
    } else {
      return undefined;
    }
  },
} satisfies Strategies<string, [CodePoint]>;

//////////

export interface PresentOptions {
  indentation: number;
  flow: boolean;

  versionDirective: boolean;
  startMarker: boolean;
  endMarker: boolean;
  trailingNewline: boolean,

  scalarStyle: StrategyOptions<typeof scalarStyleStrategies>,
  doubleQuoteEscapeCharacters: StrategyOptions<typeof doubleQuoteEscapeCharacters>,
  doubleQuoteEscapeStyle: StrategyOptions<typeof doubleQuoteEscapeStrategies>,
}

export const DEFAULT_PRESENT_OPTIONS = {
  indentation: 2,
  flow: false,

  versionDirective: true,
  startMarker: true,
  endMarker: true,
  trailingNewline: true,

  scalarStyle: [ScalarStyle.double, ScalarStyle.plain],
  doubleQuoteEscapeCharacters: [],
  doubleQuoteEscapeStyle: ['builtin', 'x', 'u', 'U'],
} satisfies PresentOptions;
