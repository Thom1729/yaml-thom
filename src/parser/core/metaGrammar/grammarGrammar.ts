import {
  ref,
  str,
  sequence,
  first,
  optional,
  plus,
  star,
  negativeLookahead,
  minus,
  charSet,

  type Grammar,
} from '@/parser/core/helpers';

export const grammar = {
  anyChar: {
    body: charSet([0, 0x10_FFFF]),
  },
  decimalDigit: {
    body: charSet(['0', '9']),
  },
  hexDigit: {
    body: charSet(['0', '9'], ['a', 'f'], ['A', 'F']),
  },

  productionNameChar: {
    body: charSet(['a', 'z'], ['0', '9']),
  },

  comment: {
    body: sequence(
      str('#'),
      star(minus(ref('anyChar'), str('\n'))),
      str('\n'),
    ),
  },

  space: {
    body: plus(first(
      ref('comment'),
      sequence(
        str('/*'),
        star(first(
          minus(ref('anyChar'), str('*')),
          sequence(str('*'), negativeLookahead(str('/'))),
        )),
        str('*/'),
      ),
      str(' '),
      str('\n'),
    )),
  },

  hexChar: {
    body: sequence(
      str('x'),
      plus(ref('hexDigit')),
    ),
  },

  charRange: {
    body: sequence(
      str('['),
      ref('hexChar'),
      str('-'),
      ref('hexChar'),
      str(']'),
    )
  },

  string: {
    body: first(
      sequence(str('\''), star(minus(ref('anyChar'), str('\''))), str('\'')),
      sequence(str('"'), star(minus(ref('anyChar'), str('"'))), str('"')),
    ),
  },

  productionName: {
    body: sequence(
      plus(ref('productionNameChar')),
      star(sequence(
        first(str('-'), str('+')),
        plus(ref('productionNameChar')),
      )),
    ),
  },

  productionParameters: {
    body: sequence(
      str('('),
      optional(ref('space')),

      ref('parameter'),
      star(sequence(
        str(','),
        optional(ref('space')),
        ref('parameter'),
      )),

      optional(ref('space')),
      str(')'),
    ),
  },

  parameter: {
    body: first(
      str('in-flow(c)'),
      plus(minus(ref('anyChar'), str(')'), str(','))),
    ),
  },

  productionRef: {
    body: sequence(
      ref('productionName'),
      optional(ref('productionParameters')),
    ),
  },

  grammar: {
    body: sequence(
      optional(ref('space')),
      ref('production'),
      star(sequence(
        ref('space'),
        ref('production'),
      )),
      optional(ref('space')),
    ),
  },

  production: {
    body: sequence(
      optional(sequence(
        ref('productionNumber'),
        ref('space'),
      )),

      ref('productionRef'),
      optional(ref('space')),
      str('::='),
      optional(ref('space')),
      ref('alternation'),
    ),
  },

  productionNumber: {
    body: sequence(
      str('['),
      plus(ref('decimalDigit')),
      str(']'),
    ),
  },

  alternation: {
    body: sequence(
      ref('sequence'),
      star(sequence(
        optional(ref('space')),
        str('|'),
        optional(ref('space')),
        ref('sequence'),
      )),
    ),
  },

  sequence: {
    body: sequence(
      ref('minus'),
      star(sequence(
        ref('space'),
        ref('minus'),
      )),
    ),
  },

  minus: {
    body: sequence(
      ref('quantified'),
      star(sequence(
        ref('space'),
        str('-'),
        ref('space'),
        ref('quantified'),
      )),
    ),
  },

  quantified: {
    body: sequence(
      ref('atom'),
      star(ref('quantifier')),
    ),
  },

  quantifier: {
    body: first(
      str('?'),
      str('*'),
      str('+'),
      sequence(str('{'), plus(ref('decimalDigit')), str('}')),
    ),
  },

  atom: {
    body: first(
      ref('hexChar'),
      ref('charRange'),
      ref('string'),
      sequence(ref('productionRef'), negativeLookahead(sequence(ref('space'), str('::=')))),
      ref('special'),
      ref('parenthesized'),
      ref('lookaround'),
    ),
  },

  special: {
    body: sequence(
      str('<'),
      ref('productionName'),
      str('>'),
    ),
  },

  parenthesized: {
    body: sequence(
      str('('),
      optional(ref('space')),
      ref('alternation'),
      optional(ref('space')),
      str(')'),
    ),
  },

  lookaround: {
    body: sequence(
      str('['),
      ref('space'),
      ref('lookaroundType'),
      ref('space'),
      ref('lookaroundOperator'),
      ref('space'),
      ref('alternation'),
      ref('space'),
      str(']'),
    ),
  },

  lookaroundType: {
    body: first(str('lookahead'), str('lookbehind')),
  },
  lookaroundOperator: {
    body: first(str('='), str('≠')),
  },
} as const satisfies Grammar;
