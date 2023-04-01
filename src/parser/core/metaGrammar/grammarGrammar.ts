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

  type Grammar,
  charSet,
} from '@/parser/core/helpers';

export const grammar = {
  anyChar: charSet([0, 0x10_FFFF]),
  decimalDigit: charSet(['0', '9']),
  hexDigit: charSet(['0', '9'], ['a', 'f'], ['A', 'F']),

  productionNameChar: charSet(['a', 'z'], ['0', '9']),

  comment: sequence(
    str('#'),
    star(minus(ref('anyChar'), str('\n'))),
    str('\n'),
  ),

  space: plus(first(
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

  hexChar: sequence(
    str('x'),
    plus(ref('hexDigit')),
  ),

  charRange: sequence(
    str('['),
    ref('hexChar'),
    str('-'),
    ref('hexChar'),
    str(']'),
  ),

  string: first(
    sequence(str('\''), star(minus(ref('anyChar'), str('\''))), str('\'')),
    sequence(str('"'), star(minus(ref('anyChar'), str('"'))), str('"')),
  ),

  productionName: sequence(
    plus(ref('productionNameChar')),
    star(sequence(
      first(str('-'), str('+')),
      plus(ref('productionNameChar')),
    )),
  ),

  productionParameters: sequence(
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

  parameter: first(
    str('in-flow(c)'),
    plus(minus(ref('anyChar'), str(')'), str(','))),
  ),

  productionRef: sequence(
    ref('productionName'),
    optional(ref('productionParameters')),
  ),

  grammar: sequence(
    optional(ref('space')),
    ref('production'),
    star(sequence(
      ref('space'),
      ref('production'),
    )),
    optional(ref('space')),
  ),

  production: sequence(
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

  productionNumber: sequence(
    str('['),
    plus(ref('decimalDigit')),
    str(']'),
  ),

  alternation: sequence(
    ref('sequence'),
    star(sequence(
      optional(ref('space')),
      str('|'),
      optional(ref('space')),
      ref('sequence'),
    )),
  ),

  sequence: sequence(
    ref('minus'),
    star(sequence(
      ref('space'),
      ref('minus'),
    )),
  ),

  minus: sequence(
    ref('quantified'),
    star(sequence(
      ref('space'),
      str('-'),
      ref('space'),
      ref('quantified'),
    )),
  ),

  quantified: sequence(
    ref('atom'),
    star(ref('quantifier')),
  ),

  quantifier: first(
    str('?'),
    str('*'),
    str('+'),
    sequence(str('{'), plus(ref('decimalDigit')), str('}')),
  ),

  atom: first(
    ref('hexChar'),
    ref('charRange'),
    ref('string'),
    sequence(ref('productionRef'), negativeLookahead(sequence(ref('space'), str('::=')))),
    ref('special'),
    ref('parenthesized'),
    ref('lookaround'),
  ),

  special: sequence(
    str('<'),
    ref('productionName'),
    str('>'),
  ),

  parenthesized: sequence(
    str('('),
    optional(ref('space')),
    ref('alternation'),
    optional(ref('space')),
    str(')'),
  ),

  lookaround: sequence(
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

  lookaroundType: first(str('lookahead'), str('lookbehind')),
  lookaroundOperator: first(str('='), str('≠')),
} as const satisfies Grammar;
