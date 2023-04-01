import {
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
    star(minus('anyChar', str('\n'))),
    str('\n'),
  ),

  space: plus(first(
    'comment',
    sequence(
      str('/*'),
      star(first(
        minus('anyChar', str('*')),
        sequence(str('*'), negativeLookahead(str('/'))),
      )),
      str('*/'),
    ),
    str(' '),
    str('\n'),
  )),

  hexChar: sequence(
    str('x'),
    plus('hexDigit'),
  ),

  charRange: sequence(
    str('['),
    'hexChar',
    str('-'),
    'hexChar',
    str(']'),
  ),

  string: first(
    sequence(str('\''), star(minus('anyChar', str('\''))), str('\'')),
    sequence(str('"'), star(minus('anyChar', str('"'))), str('"')),
  ),

  productionName: sequence(
    plus('productionNameChar'),
    star(sequence(
      first(str('-'), str('+')),
      plus('productionNameChar'),
    )),
  ),

  productionParameters: sequence(
    str('('),
    optional('space'),

    'parameter',
    star(sequence(
      str(','),
      optional('space'),
      'parameter',
    )),

    optional('space'),
    str(')'),
  ),

  parameter: first(
    str('in-flow(c)'),
    plus(minus('anyChar', str(')'), str(','))),
  ),

  productionRef: sequence(
    'productionName',
    optional('productionParameters'),
  ),

  grammar: sequence(
    optional('space'),
    'production',
    star(sequence(
      'space',
      'production',
    )),
    optional('space'),
  ),

  production: sequence(
    optional(sequence(
      'productionNumber',
      'space',
    )),

    'productionRef',
    optional('space'),
    str('::='),
    optional('space'),
    'alternation',
  ),

  productionNumber: sequence(
    str('['),
    plus('decimalDigit'),
    str(']'),
  ),

  alternation: sequence(
    'sequence',
    star(sequence(
      optional('space'),
      str('|'),
      optional('space'),
      'sequence',
    )),
  ),

  sequence: sequence(
    'minus',
    star(sequence(
      'space',
      'minus',
    )),
  ),

  minus: sequence(
    'quantified',
    star(sequence(
      'space',
      str('-'),
      'space',
      'quantified',
    )),
  ),

  quantified: sequence(
    'atom',
    star('quantifier'),
  ),

  quantifier: first(
    str('?'),
    str('*'),
    str('+'),
    sequence(str('{'), plus('decimalDigit'), str('}')),
  ),

  atom: first(
    'hexChar',
    'charRange',
    'string',
    sequence('productionRef', negativeLookahead(sequence('space', str('::=')))),
    'special',
    'parenthesized',
    'lookaround',
  ),

  special: sequence(
    str('<'),
    'productionName',
    str('>'),
  ),

  parenthesized: sequence(
    str('('),
    optional('space'),
    'alternation',
    optional('space'),
    str(')'),
  ),

  lookaround: sequence(
    str('['),
    'space',
    'lookaroundType',
    'space',
    'lookaroundOperator',
    'space',
    'alternation',
    'space',
    str(']'),
  ),

  lookaroundType: first(str('lookahead'), str('lookbehind')),
  lookaroundOperator: first(str('='), str('≠')),
} as const satisfies Grammar;
