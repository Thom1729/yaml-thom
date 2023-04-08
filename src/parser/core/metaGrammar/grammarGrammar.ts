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
} from '../grammarType';

export const grammar = {
  anyChar: {
    number: null,
    body: charSet([0, 0x10_FFFF]),
  },
  decimalDigit: {
    number: null,
    body: charSet(['0', '9']),
  },
  hexDigit: {
    number: null,
    body: charSet(['0', '9'], ['a', 'f'], ['A', 'F']),
  },

  productionNameChar: {
    number: null,
    body: charSet(['a', 'z'], ['0', '9']),
  },

  comment: {
    number: null,
    body: sequence(
      str('#'),
      star(minus(ref('anyChar'), str('\n'))),
      str('\n'),
    ),
  },

  space: {
    number: null,
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
    number: null,
    body: sequence(
      str('x'),
      plus(ref('hexDigit')),
    ),
  },

  charRange: {
    number: null,
    body: sequence(
      str('['),
      ref('hexChar'),
      str('-'),
      ref('hexChar'),
      str(']'),
    )
  },

  string: {
    number: null,
    body: first(
      sequence(str('\''), star(minus(ref('anyChar'), str('\''))), str('\'')),
      sequence(str('"'), star(minus(ref('anyChar'), str('"'))), str('"')),
    ),
  },

  productionName: {
    number: null,
    body: sequence(
      plus(ref('productionNameChar')),
      star(sequence(
        first(str('-'), str('+')),
        plus(ref('productionNameChar')),
      )),
    ),
  },

  productionParameters: {
    number: null,
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
    number: null,
    body: first(
      str('in-flow(c)'),
      plus(minus(ref('anyChar'), str(')'), str(','))),
    ),
  },

  productionRef: {
    number: null,
    body: sequence(
      ref('productionName'),
      optional(ref('productionParameters')),
    ),
  },

  grammar: {
    number: null,
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
    number: null,
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
    number: null,
    body: sequence(
      str('['),
      plus(ref('decimalDigit')),
      str(']'),
    ),
  },

  alternation: {
    number: null,
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
    number: null,
    body: sequence(
      ref('minus'),
      star(sequence(
        ref('space'),
        ref('minus'),
      )),
    ),
  },

  minus: {
    number: null,
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
    number: null,
    body: sequence(
      ref('atom'),
      star(ref('quantifier')),
    ),
  },

  quantifier: {
    number: null,
    body: first(
      str('?'),
      str('*'),
      str('+'),
      sequence(str('{'), plus(ref('decimalDigit')), str('}')),
    ),
  },

  atom: {
    number: null,
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
    number: null,
    body: sequence(
      str('<'),
      ref('productionName'),
      str('>'),
    ),
  },

  parenthesized: {
    number: null,
    body: sequence(
      str('('),
      optional(ref('space')),
      ref('alternation'),
      optional(ref('space')),
      str(')'),
    ),
  },

  lookaround: {
    number: null,
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
    number: null,
    body: first(str('lookahead'), str('lookbehind')),
  },
  lookaroundOperator: {
    number: null,
    body: first(str('='), str('≠')),
  },
} as const satisfies Grammar;
