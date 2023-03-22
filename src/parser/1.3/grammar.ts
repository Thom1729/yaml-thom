import {
  empty,
  startOfLine,
  endOfInput,
  str,
  ref,
  first,
  optional,
  plus,
  star,
  repeat,
  lookahead,
  negativeLookahead,
  lookbehind,
  detectIndentation,
  context,

  type Grammar,
  // named,
} from '../core/helpers';

import { ChompingBehavior } from '../core/ast';

import { CharSet } from '../core/charSet';

const YAML_CHARACTER = new CharSet(
  0x09, // Tab
  0x0A, // Line Feed
  0x0D, // Carriage return
  [0x20, 0x7E], // Printable ASCII

  0x85, // Next line (NEL)
  [0xA0, 0xD7FF], // Basic multilingual plane (BMP)
  [0xE000, 0xFFFD], // Additional unicode areas
  [0x010000, 0x10FFFF], // Astral planes
);

const NON_BREAK_CHARACTER = YAML_CHARACTER.minus(
  new CharSet(0x0a, 0x0d, 0xfeff)
);

const BLANK_CHARACTER = new CharSet(
  0x09, // Space
  0x20, // Tab
);

const NON_SPACE_CHARACTER = NON_BREAK_CHARACTER.minus(BLANK_CHARACTER);

const DECIMAL_DIGIT = new CharSet([0x30, 0x39]);
const DECIMAL_DIGIT_1_9 = new CharSet([0x31, 0x39]);
const HEXADECIMAL_DIGIT = new CharSet(
  [0x30, 0x39],
  [0x41, 0x46],
  [0x61, 0x66],
);

const BYTE_ORDER_MARK = new CharSet(0xfeff);

const FLOW_COLLECTION_INDICATORS = new CharSet(
  ',',
  '{',
  '}',
  '[',
  ']',
);

const ANCHOR_CHARACTER = NON_SPACE_CHARACTER.minus(FLOW_COLLECTION_INDICATORS);

const JSON_CHARACTER = new CharSet(0x09, [0x20, 0x10ffff]);

const ASCII_ALPHA_CHARACTER = new CharSet([0x41, 0x5a], [0x61, 0x7a]);

const x = new CharSet(
  '?', // Mapping key
  ':', // Mapping value
  '-', // Sequence entry
  '{', // Mapping start
  '}', // Mapping end
  '[', // Sequence start
  ']', // Sequence end
  ',', // Entry separator
  '#', // Comment
  '&', // Anchor
  '*', // Alias
  '!', // Tag
  '|', // Literal scalar
  '>', // Folded scalar
  '\'', // Single quote
  '"', // Double quote
  '%', // Directive
  '@', // Reserved
  '`', // Reserved
);
const PLAIN_SCALAR_FIRST_CHARACTER = NON_SPACE_CHARACTER.minus(x);

const BASE_GRAMMAR: Grammar = {
  /* 1 */ 'yaml-stream': [
    star('document-prefix'),
    optional('any-document'),
    star(first(
      [plus('document-suffix'), star('document-prefix'), optional('any-document')],
      'byte-order-mark',
      'comment-line',
      'start-indicator-and-document',
    ))
  ],

  /* 2 */ 'document-prefix': [
    optional('byte-order-mark'),
    star('blanks-and-comment-line'),
  ],

  /* 3 */ 'document-suffix': [
    'document-end-indicator',
    'comment-lines',
  ],

  /* 4 */ 'document-start-indicator': str('---'),

  /* 5 */ 'document-end-indicator': str('...'), // TODO: Not followed by non-ws char

  /* 6 */ 'any-document': first(
    'directives-and-document',
    'start-indicator-and-document',
    'bare-document',
  ),

  /* 7 */ 'directives-and-document': [
    plus('directive-line'),
    'start-indicator-and-document',
  ],

  /* 8 */ 'start-indicator-and-document': [
    'document-start-indicator',
    first(
      'bare-document',
      ['empty-node', 'comment-lines'],
    )
  ],

  /* 9 */ 'bare-document': ref('block-node', { n: -1, c: 'BLOCK-IN' }),

  /* 10 */ 'directive-line': [
    str('%'),
    first(
      'yaml-directive-line',
      'tag-directive-line',
      'reserved-directive-line',
    ),
    'comment-lines',
  ],

  /* 11 */ 'forbidden-content': [
    startOfLine,
    first(
      'document-start-indicator',
      'document-end-indicator',
    ),
    first(
      'line-ending',
      'blank-character',
    ),
  ],

  /* 12 */ 'block-node': ({ n, c }) => first(
    ref('block-node-in-a-block-node', { n, c }),
    ref('flow-node-in-a-block-node', { n }),
  ),

  /* 13 */ 'block-node-in-a-block-node': ({ n, c }) => first(
    ref('block-scalar', { n, c }),
    ref('block-collection', { n, c }),
  ),

  /* 14 */ 'flow-node-in-a-block-node': ({ n }) => [
    ref('separation-characters', { n: n + 1, c: 'FLOW-OUT' }),
    ref('flow-node', { n: n + 1, c: 'FLOW-OUT' }),
    'comment-lines',
  ],

  /* 15 */ 'block-collection': ({ n, c }) => [
    optional([
      ref('separation-characters', { n: n + 1, c }),
      ref('node-properties', { n: n + 1, c }),
    ]),
    'comment-lines',
    first(
      ref('block-sequence-context', { n, c }),
      ref('block-mapping', { n }),
    ),
  ],

  /* 16 */ 'block-sequence-context': ({ n, c }) => context(c, {
    'BLOCK-OUT': ref('block-sequence', { n: n - 1 }),
    'BLOCK-IN': ref('block-sequence', { n: n }),
  }),

  /* 17 */ 'block-scalar': ({ n, c }) => [
    ref('separation-characters', { n: n + 1, c }),
    optional([
      ref('node-properties', { n: n + 1, c }),
      ref('separation-characters', { n: n + 1, c }),
    ]),
    first(
      ref('block-literal-scalar', { n }),
      ref('block-folded-scalar', { n }),
    ),
  ],

  /* 18 */ 'block-mapping': ({ n }) =>
    detectIndentation(n + 1, n => plus([
      ref('indentation-spaces', { n }),
      ref('block-mapping-entry', { n }),
    ])),

  /* 19 */ 'block-mapping-entry': ({ n }) => first(
    ref('block-mapping-explicit-entry', { n }),
    ref('block-mapping-implicit-entry', { n }),
  ),

  /* 20 */ 'block-mapping-explicit-entry': ({ n }) => [
    ref('block-mapping-explicit-key', { n }),
    first(
      ref('block-mapping-explicit-value', { n }),
      'empty-node',
    ),
  ],

  /* 21 */ 'block-mapping-explicit-key': ({ n }) => [
    str('?'),
    ref('block-indented-node', { n, c: 'BLOCK-OUT' }),
  ],

  /* 22 */ 'block-mapping-explicit-value': ({ n }) => [
    ref('indentation-spaces', { n }),
    str(':'),
    ref('block-indented-node', { n, c: 'BLOCK-OUT' }),
  ],

  /* 23 */ 'block-mapping-implicit-entry': ({ n }) => [
    first(
      'block-mapping-implicit-key',
      'empty-node',
    ),
    ref('block-mapping-implicit-value', { n }),
  ],

  /* 24 */ 'block-mapping-implicit-key': first(
    ref('implicit-json-key', { c: 'BLOCK-KEY' }),
    ref('implicit-yaml-key', { c: 'BLOCK-KEY' }),
  ),

  /* 25 */ 'block-mapping-implicit-value': ({ n }) => [
    str(':'),
    first(
      ref('block-node', { n, c: 'BLOCK-OUT' }),
      [
        'empty-node',
        'comment-lines',
      ],
    ),
  ],

  /* 26 */ 'compact-mapping': ({ n }) => [
    ref('block-mapping-entry', { n }),
    star([
      ref('indentation-spaces', { n }),
      ref('block-mapping-entry', { n }),
    ]),
  ],

  /* 27 */ 'block-sequence': ({ n }) =>
    detectIndentation(n + 1, n => plus([
      ref('indentation-spaces', { n }),
      ref('block-sequence-entry', { n }),
    ])),

  /* 28 */ 'block-sequence-entry': ({ n }) => [
    str('-'),
    negativeLookahead('non-space-character'),
    ref('block-indented-node', { n, c: 'BLOCK-IN' }),
  ],

  /* 29 */ 'block-indented-node': ({ n, c }) => first(
    detectIndentation(1, m => [
      ref('indentation-spaces', { n: m }),
      first(
        // ref('compact-sequence', { n: m }),
        // ref('compact-mapping', { n: m }),
        ref('compact-sequence', { n: n + m + 1 }),
        ref('compact-mapping', { n: n + m + 1 }),
      ),
    ]),
    ref('block-node', { n, c }),
    [
      'empty-node',
      'comment-lines',
    ],
  ),

  /* 30 */ 'compact-sequence': ({ n }) => [
    ref('block-sequence-entry', { n }),
    star([
      ref('indentation-spaces', { n }),
      ref('block-sequence-entry', { n }),
    ]),
  ],

  /* 31 */ 'block-literal-scalar': ({ n }) => first(
    ...Object.values(ChompingBehavior).map(t => [
      str('|'),
      ref('block-scalar-indicators', { t }),
      // detectIndentation(0, m => ref('literal-scalar-content', { n: n + m, t })),
      // detectIndentation(n, m => ref('literal-scalar-content', { n: m, t })),
      ref('literal-scalar-content', { n: n+1, t }),
    ])
  ),

  /* 32 */ 'literal-scalar-content': ({ n, t }) => [
    optional([
      ref('literal-scalar-line-content', { n }),
      star(ref('literal-scalar-next-line', { n })),
      ref('block-scalar-chomp-last', { t }),
    ]),
    ref('block-scalar-chomp-empty', { n, t }),
  ],

  /* 33 */ 'literal-scalar-line-content': ({ n }) => [
    star(ref('empty-line', { n, c: 'BLOCK-IN' })),
    negativeLookahead('forbidden-content'), // TODO
    ref('indentation-spaces', { n }),
    plus('non-break-character'),
  ],

  /* 34 */ 'literal-scalar-next-line': ({ n }) => [
    'break-as-line-feed',
    ref('literal-scalar-line-content', { n }),
  ],

  /* 35 */ 'block-folded-scalar': ({ n }) => first(
    ...Object.values(ChompingBehavior).map(t => [
      str('>'),
      ref('block-scalar-indicators', { t }),
      // detectIndentation(0, m => ref('folded-scalar-content', { n: n + m, t })),
      ref('folded-scalar-content', { n: n+1, t }),
    ])
  ),

  // /* 35 */ 'block-folded-scalar': ({ n }) => first(
  //   ...Object.values(ChompingBehavior).map(t => [
  //     str('>'),
  //     optional(ref('block-scalar-indicators', { t })),
  //     detectIndentation(0, m => ref('folded-scalar-content', { n: n + m, t })),
  //   ])
  // ),

  /* 36 */ 'folded-scalar-content': ({ n, t }) => [
    optional([
      ref('folded-scalar-lines-different-indentation', { n }),
      ref('block-scalar-chomp-last', { t }),
    ]),
    ref('block-scalar-chomp-empty', { n, t }),
  ],

  /* 37 */ 'folded-scalar-lines-different-indentation': ({ n }) => [
    ref('folded-scalar-lines-same-indentation', { n }),
    star([
      'break-as-line-feed',
      ref('folded-scalar-lines-same-indentation', { n }),
    ]),
  ],

  /* 38 */ 'folded-scalar-lines-same-indentation': ({ n }) => [
    star(ref('empty-line', { n, c: 'BLOCK-IN' })),
    first(
      ref('folded-scalar-lines', { n }),
      ref('folded-scalar-spaced-lines', { n }),
    ),
  ],

  /* 39 */ 'folded-scalar-lines': ({ n }) => [
    ref('folded-scalar-text', { n }),
    star([
      ref('folded-whitespace', { n, c: 'BLOCK-IN' }),
      ref('folded-scalar-text', { n }),
    ]),
  ],

  /* 40 */ 'folded-scalar-spaced-lines': ({ n }) => [
    ref('folded-scalar-spaced-text', { n }),
    star([
      ref('line-break-and-empty-lines', { n }),
      ref('folded-scalar-spaced-text', { n }),
    ]),
  ],

  /* 41 */ 'folded-scalar-text': ({ n }) => [
    negativeLookahead('forbidden-content'), // TODO
    ref('indentation-spaces', { n }),
    'non-space-character',
    star('non-break-character'),
  ],

  /* 42 */ 'line-break-and-empty-lines': ({ n }) => [
    'break-as-line-feed',
    star(ref('empty-line', { n, c: 'BLOCK-IN' })),
  ],

  /* 43 */ 'folded-scalar-spaced-text': ({ n }) => [
    ref('indentation-spaces', { n }),
    'blank-character',
    star('non-break-character'),
  ],

  /* 44 */ 'block-scalar-indicators': ({ t }) => [
    first(
      [
        'block-scalar-indentation-indicator',
        ref('block-scalar-chomping-indicator', { t }),
      ],
      [
        ref('block-scalar-chomping-indicator', { t }),
        'block-scalar-indentation-indicator',
      ],
    ),
    'comment-line',
  ],

  /* 45 */ 'block-scalar-indentation-indicator': 'decimal-digit-1-9',

  /* 46 */ 'block-scalar-chomping-indicator': ({ t }) => context(t, {
    STRIP: str('-'),
    KEEP: str('+'),
    CLIP: empty,
  }),

  /* 47 */ 'block-scalar-chomp-last': ({ t }) => context(t, {
    STRIP: first('line-break', endOfInput),
    KEEP: first('break-as-line-feed', endOfInput),
    CLIP: first('break-as-line-feed', endOfInput),
  }),

  /* 48 */ 'block-scalar-chomp-empty': ({ n, t }) => context(t, {
    'STRIP': ref('line-strip-empty', { n }),
    'CLIP': ref('line-strip-empty', { n }),
    'KEEP': ref('line-keep-empty', { n }),
  }),

  /* 49 */ 'line-strip-empty': ({ n }) => [
    star([
      ref('indentation-spaces-less-than-or-equal', { n }),
      'line-break',
    ]),
    optional(ref('line-trail-comments', { n })),
  ],

  /* 50 */ 'line-keep-empty': ({ n }) => [
    star(ref('empty-line', { n, c: 'BLOCK-IN' })),
    optional(ref('line-trail-comments', { n })),
  ],

  /* 51 */ 'line-trail-comments': ({ n }) => [
    ref('indentation-spaces-less-than', { n }),
    'comment-content',
    'line-ending',
    star('comment-line'),
  ],

  /* 52 */ 'flow-node': ({ n, c }) => first(
    'alias-node',
    ref('flow-content', { n, c }),
    [
      ref('node-properties', { n, c }),
      first(
        [
          ref('separation-characters', { n, c }),
          ref('flow-content', { n, c }),
        ],
        'empty-node',
      ),
    ],
  ),

  /* 53 */ 'flow-content': ({ n, c }) => first(
    ref('flow-yaml-content', { n, c }),
    ref('flow-json-content', { n, c }),
  ),

  /* 54 */ 'flow-yaml-content': ({ n, c }) => ref('flow-plain-scalar', { n, c }),

  /* 55 */ 'flow-json-content': ({ n, c }) => first(
    ref('flow-sequence', { n, c }),
    ref('flow-mapping', { n, c }),
    ref('single-quoted-scalar', { n, c }),
    ref('double-quoted-scalar', { n, c }),
  ),

  /* 56 */ 'flow-mapping': ({ n, c }) => [
    str('{'),
    optional(ref('separation-characters', { n, c })),
    optional(ref('flow-mapping-context', { n, c })),
    str('}'),
  ],

  /* 57 */ 'flow-mapping-entries': ({ n, c }) => [
    ref('flow-mapping-entry', { n, c }),
    optional(ref('separation-characters', { n, c })),
    optional([
      str(','),
      optional(ref('separation-characters', { n, c })),
      optional(ref('flow-mapping-entries', { n, c })),
    ])
  ],

  /* 58 */ 'flow-mapping-entry': ({ n, c }) => first(
    [
      str('?'),
      ref('separation-characters', { n, c }),
      ref('flow-mapping-explicit-entry', { n, c }),
    ],
    ref('flow-mapping-implicit-entry', { n, c }),
  ),

  /* 59 */ 'flow-mapping-explicit-entry': ({ n, c }) => first(
    ref('flow-mapping-implicit-entry', { n, c }),
    ['empty-node', 'empty-node'],
  ),

  /* 60 */ 'flow-mapping-implicit-entry': ({ n, c }) => first(
    ref('flow-mapping-yaml-key-entry', { n, c }),
    ref('flow-mapping-empty-key-entry', { n, c }),
    ref('flow-mapping-json-key-entry', { n, c }),
  ),

  /* 61 */ 'flow-mapping-yaml-key-entry': ({ n, c }) => [
    ref('flow-yaml-node', { n, c }),
    first(
      [
        optional(ref('separation-characters', { n, c })),
        ref('flow-mapping-separate-value', { n, c }),
      ],
      'empty-node',
    ),
  ],

  /* 62 */ 'flow-mapping-empty-key-entry': ({ n, c }) => [
    'empty-node',
    ref('flow-mapping-separate-value', { n, c }),
  ],

  /* 63 */ 'flow-mapping-separate-value': ({ n, c }) => [
    str(':'),
    negativeLookahead(ref('non-space-plain-scalar-character', { c })),
    first(
      [
        ref('separation-characters', { n, c }),
        ref('flow-node', { n, c }),
      ],
      'empty-node',
    ),
  ],

  /* 64 */ 'flow-mapping-json-key-entry': ({ n, c }) => [
    ref('flow-json-node', { n, c }),
    first(
      [
        optional(ref('separation-characters', { n, c })),
        ref('flow-mapping-adjacent-value', { n, c }),
      ],
      'empty-node',
    ),
  ],

  /* 65 */ 'flow-mapping-adjacent-value': ({ n, c }) => [
    str(':'),
    first(
      [
        optional(ref('separation-characters', { n, c })),
        ref('flow-node', { n, c }),
      ],
      'empty-node',
    ),
  ],

  /* 66 */ 'flow-pair': ({ n, c }) => first(
    [
      str('?'),
      ref('separation-characters', { n, c }),
      ref('flow-mapping-explicit-entry', { n, c }),
    ],
    ref('flow-pair-entry', { n, c }),
  ),

  /* 67 */ 'flow-pair-entry': ({ n, c }) => first(
    ref('flow-pair-yaml-key-entry', { n, c }),
    ref('flow-mapping-empty-key-entry', { n, c }),
    ref('flow-pair-json-key-entry', { n, c }),
  ),

  /* 68 */ 'flow-pair-yaml-key-entry': ({ n, c }) => [
    ref('implicit-yaml-key', { c: 'FLOW-KEY' }),
    ref('flow-mapping-separate-value', { n, c }),
  ],

  /* 69 */ 'flow-pair-json-key-entry': ({ n, c }) => [
    ref('implicit-json-key', { c: 'FLOW-KEY' }),
    ref('flow-mapping-adjacent-value', { n, c }),
  ],

  /* 70 */ 'implicit-yaml-key': ({ c }) => [
    ref('flow-yaml-node', { n: 0, c }),
    optional('separation-blanks'),
    // TODO: 1024 limit
  ],

  /* 71 */ 'implicit-json-key': ({ c }) => [
    ref('flow-json-node', { n: 0, c }),
    optional('separation-blanks'),
    // TODO: 1024 limit
  ],

  /* 72 */ 'flow-yaml-node': ({ n, c }) => first(
    'alias-node',
    ref('flow-yaml-content', { n, c }),
    [
      ref('node-properties', { n, c }),
      first(
        [
          ref('separation-characters', { n, c }),
          ref('flow-yaml-content', { n, c }),
        ],
        'empty-node',
      ),
    ],
  ),

  /* 73 */ 'flow-json-node': ({ n, c }) => [
    optional([
      ref('node-properties', { n, c }),
      ref('separation-characters', { n, c }),
    ]),
    ref('flow-json-content', { n, c }),
  ],

  /* 74 */ 'flow-sequence': ({ n, c }) => [
    str('['),
    optional(ref('separation-characters', { n, c })),
    optional(ref('flow-sequence-context', { n, c })),
    str(']'),
  ],

  /* 75 */ 'flow-sequence-entries': ({ n, c }) => [
    ref('flow-sequence-entry', { n, c }),
    optional(ref('separation-characters', { n, c })),
    optional([
      str(','),
      optional(ref('separation-characters', { n, c })),
      optional(ref('flow-sequence-entries', { n, c })),
    ]),
  ],

  /* 76 */ 'flow-sequence-entry': ({ n, c }) => first(
    ref('flow-pair', { n, c }),
    ref('flow-node', { n, c }),
  ),

  /* 77 */ 'double-quoted-scalar': ({ n, c }) => [
    str('"'),
    ref('double-quoted-text', { n, c }),
    str('"'),
  ],

  /* 78 */ 'double-quoted-text': ({ n, c }) => context(c, {
    'BLOCK-KEY': 'double-quoted-one-line',
    'FLOW-KEY': 'double-quoted-one-line',
    'FLOW-OUT': ref('double-quoted-multi-line', { n }),
    'FLOW-IN': ref('double-quoted-multi-line', { n }),
  }),

  /* 79 */ 'double-quoted-multi-line': ({ n }) => [
    'double-quoted-first-line',
    first(
      ref('double-quoted-next-line', { n }),
      star('blank-character'),
    ),
  ],

  /* 80 */ 'double-quoted-one-line': star('non-break-double-quoted-character'),
  
  /* 81 */ 'double-quoted-first-line': star([
    star('blank-character'),
    'non-space-double-quoted-character',
  ]),

  /* 82 */ 'double-quoted-next-line': ({ n }) => [
    first(
      ref('double-quoted-line-continuation', { n }),
      ref('flow-folded-whitespace', { n }),
    ),
    optional([
      'non-space-double-quoted-character',
      'double-quoted-first-line',
      first(
        ref('double-quoted-next-line', { n }),
        star('blank-character'),
      )
    ]),
  ],

  /* 83 */ 'non-space-double-quoted-character': [
    negativeLookahead('blank-character'),
    'non-break-double-quoted-character',
  ],

  /* 84 */ 'non-break-double-quoted-character': first(
    'double-quoted-scalar-escape-character',
    [
      negativeLookahead(str('\\')),
      negativeLookahead(str('"')),
      'json-character',
    ]
  ),

  /* 85 */ 'double-quoted-line-continuation': ({ n }) => [
    star('blank-character'),
    str('\\'),
    'line-break',
    star(ref('empty-line', { n, c: 'FLOW-IN'})),
    ref('indentation-spaces-plus-maybe-more', { n }),
  ],

  /* 86 */ 'flow-mapping-context': ({ n, c }) => context(c, {
    'FLOW-OUT': ref('flow-mapping-entries', { n, c: 'FLOW-IN' }),
    'FLOW-IN' : ref('flow-mapping-entries', { n, c: 'FLOW-IN' }),
    'BLOCK-KEY': ref('flow-mapping-entries', { n, c: 'FLOW-KEY' }),
    'FLOW-KEY' : ref('flow-mapping-entries', { n, c: 'FLOW-KEY' }),
  }),

  /* 87 */ 'flow-sequence-context': ({ n, c }) => context(c, {
    'FLOW-OUT': ref('flow-sequence-entries', { n, c: 'FLOW-IN' }),
    'FLOW-IN' : ref('flow-sequence-entries', { n, c: 'FLOW-IN' }),
    'BLOCK-KEY': ref('flow-sequence-entries', { n, c: 'FLOW-KEY' }),
    'FLOW-KEY' : ref('flow-sequence-entries', { n, c: 'FLOW-KEY' }),
  }),

  /* 88 */ 'single-quoted-scalar': ({ n, c }) => [
    str('\''),
    ref('single-quoted-text', { n, c}),
    str('\''),
  ],

  /* 89 */ 'single-quoted-text': ({ n, c }) => context(c, {
    'BLOCK-KEY': 'single-quoted-one-line',
    'FLOW-KEY': 'single-quoted-one-line',
    'FLOW-OUT': ref('single-quoted-multi-line', { n }),
    'FLOW-IN': ref('single-quoted-multi-line', { n }),
  }),

  /* 90 */ 'single-quoted-multi-line': ({ n }) => [
    'single-quoted-first-line',
    first(
      ref('single-quoted-next-line', { n }),
      star('blank-character'),
    ),
  ],

  /* 91 */ 'single-quoted-one-line': star('non-break-single-quoted-character'),
  
  /* 92 */ 'single-quoted-first-line': star([
    star('blank-character'),
    'non-break-single-quoted-character',
  ]),

  /* 93 */ 'single-quoted-next-line': ({ n }) => [
    ref('flow-folded-whitespace', { n }),
    optional([
      'non-space-single-quoted-character',
      'single-quoted-first-line',
      first(
        ref('single-quoted-next-line', { n }),
        star('blank-character'),
      ),
    ]),
  ],

  /* 94 */ 'non-space-single-quoted-character': [
    negativeLookahead('blank-character'),
    'non-break-single-quoted-character',
  ],

  /* 95 */ 'non-break-single-quoted-character': first(
    'single-quoted-escaped-single-quote',
    [
      negativeLookahead(str('\'')),
      'json-character',
    ]
  ),

  /* 96 */ 'single-quoted-escaped-single-quote': str('\'\''),

  /* 97 */ 'flow-plain-scalar': ({ n, c }) => context(c, {
    'FLOW-OUT': ref('plain-scalar-multi-line', { n, c: 'FLOW-OUT' }),
    'FLOW-IN': ref('plain-scalar-multi-line', { n, c: 'FLOW-IN' }),
    'BLOCK-KEY': ref('plain-scalar-single-line', { c: 'BLOCK-KEY' }),
    'FLOW-KEY': ref('plain-scalar-single-line', { c: 'FLOW-KEY' }),
  }),

  /* 98 */ 'plain-scalar-multi-line': ({ n, c }) => [
    ref('plain-scalar-single-line', { c }),
    star(ref('plain-scalar-next-line', { n, c })),
  ],

  /* 99 */ 'plain-scalar-single-line': ({ c }) => [
    negativeLookahead('forbidden-content'), // TODO
    ref('plain-scalar-first-character', { c }),
    ref('plain-scalar-line-characters', { c }),
  ],

  /* 100 */ 'plain-scalar-next-line': ({ n, c }) => [
    ref('flow-folded-whitespace', { n }),
    negativeLookahead('forbidden-content'), // TODO
    ref('plain-scalar-characters', { c }),
    ref('plain-scalar-line-characters', { c }),
  ],

  /* 101 */ 'plain-scalar-line-characters': ({ c }) =>
    star([
      star('blank-character'),
      ref('plain-scalar-characters', { c }),
    ]),

  /* 102 */ 'plain-scalar-first-character': ({ c }) => first(
    PLAIN_SCALAR_FIRST_CHARACTER,
    [
      new CharSet('?', ':', '-'),
      lookahead(ref('non-space-plain-scalar-character', { c })),
    ],
  ),

  /* 103 */ 'plain-scalar-characters': ({ c }) => first(
    [
      negativeLookahead(new CharSet(':', '#')),
      ref('non-space-plain-scalar-character', { c }),
    ],
    [
      lookbehind(NON_SPACE_CHARACTER),
      str('#'),
    ],
    [
      str(':'),
      lookahead(ref('non-space-plain-scalar-character', { c }))
    ],
  ),

  /* 104 */ 'non-space-plain-scalar-character': ({ c }) => context(c, {
    'FLOW-OUT': 'block-plain-scalar-character',
    'FLOW-IN': 'flow-plain-scalar-character',
    'BLOCK-KEY': 'block-plain-scalar-character',
    'FLOW-KEY': 'flow-plain-scalar-character',
  }),

  /* 105 */ 'block-plain-scalar-character': 'non-space-character',

  /* 105 */ 'flow-plain-scalar-character': NON_SPACE_CHARACTER.minus(FLOW_COLLECTION_INDICATORS),
  
  /* 107 */ 'alias-node': [
    str('*'),
    'anchor-name',
  ],

  /* 108 */ 'empty-node': empty,

  /* 109 */ 'indentation-spaces': ({ n }) => repeat('space-character', n, n),

  /* 110 */ 'indentation-spaces-less-than': ({ n }) => repeat('space-character', 0, n),

  /* 111 */ 'indentation-spaces-less-than-or-equal': ({ n }) => repeat('space-character', 0, n+1),

  /* 112 */ 'line-prefix-spaces': ({ n, c }) => context(c, {
    'BLOCK-OUT': ref('indentation-spaces-exact', { n }),
    'BLOCK-IN': ref('indentation-spaces-exact', { n }),
    'FLOW-OUT': ref('indentation-spaces-plus-maybe-more', { n }),
    'FLOW-IN': ref('indentation-spaces-plus-maybe-more', { n }),
  }),

  /* 113 */ 'indentation-spaces-exact': ({ n }) => ref('indentation-spaces', { n }),

  /* 114 */ 'indentation-spaces-plus-maybe-more': ({ n }) => [
    ref('indentation-spaces', { n }),
    optional('separation-blanks'),
  ],

  /* 115 */ 'flow-folded-whitespace': ({ n }) => [
    optional('separation-blanks'),
    ref('folded-whitespace', { n, c: 'FLOW-IN' }),
    ref('indentation-spaces-plus-maybe-more', { n }),
  ],

  /* 116 */ 'folded-whitespace': ({ n, c }) => first(
    [ 'line-break', plus(ref('empty-line', { n, c })) ],
    'break-as-space',
  ),

  /* 117 */ 'comment-lines': [
    first('comment-line', startOfLine),
    star('blanks-and-comment-line'),
  ],

  /* 118 */ 'comment-line': [
    optional(['separation-blanks', optional('comment-content')]),
    'line-ending',
  ],

  /* 119 */ 'blanks-and-comment-line': [
    'separation-blanks',
    optional('comment-content'),
    'line-ending',
  ],

  /* 120 */ 'comment-content': [str('#'), star('non-break-character')],

  /* 121 */ 'empty-line': ({ n, c }) => [
    first(
      ref('line-prefix-spaces', { n, c }),
      ref('indentation-spaces-less-than', { n }),
    ),
    'break-as-line-feed',
  ],

  /* 122 */ 'separation-characters': ({ n, c }) => context(c, {
    'BLOCK-OUT': ref('separation-lines', { n }),
    'BLOCK-IN': ref('separation-lines', { n }),
    'FLOW-OUT': ref('separation-lines', { n }),
    'FLOW-IN': ref('separation-lines', { n }),
    'BLOCK-KEY': 'separation-blanks',
    'FLOW-KEY': 'separation-blanks',
  }),

  /* 123 */ 'separation-lines': ({ n }) => first(
    [
      'comment-lines',
      ref('indentation-spaces-plus-maybe-more', { n }),
    ],
    'separation-blanks',
  ),

  /* 124 */ 'separation-blanks': first(
    plus('blank-character'),
    startOfLine,
  ),

  /* 125 */ 'yaml-directive-line': [
    str('YAML'),
    'separation-blanks',
    'yaml-version-number',
  ],

  /* 126 */ 'yaml-version-number': [
    plus('decimal-digit'),
    str('.'),
    plus('decimal-digit'),
  ],

  /* 127 */ 'reserved-directive-line': [
    'directive-name',
    star([
      'separation-blanks',
      'directive-parameter',
    ]),
  ],

  /* 128 */ 'directive-name': [
    plus('non-space-character'),
  ],

  /* 129 */ 'directive-parameter': [
    plus('non-space-character'),
  ],

  /* 130 */ 'tag-directive-line': [
    str('TAG'),
    'separation-blanks',
    'tag-handle',
    'separation-blanks',
    'tag-prefix',
  ],

  /* 131 */ 'tag-handle': first(
    'named-tag-handle',
    'secondary-tag-handle',
    'primary-tag-handle',
  ),

  /* 132 */ 'named-tag-handle': [
    str('!'),
    plus('word-character'),
    str('!'),
  ],

  /* 133 */ 'secondary-tag-handle': str('!!'),

  /* 134 */ 'primary-tag-handle': str('!'),

  /* 135 */ 'tag-prefix': first(
    'local-tag-prefix',
    'global-tag-prefix',
  ),

  /* 136 */ 'local-tag-prefix': [
    str('!'),
    star('uri-character'),
  ],

  /* 137 */ 'global-tag-prefix': [
    'tag-character',
    star('uri-character'),
  ],

  /* 138 */ 'node-properties': ({ n, c }) => first(
    [
      'anchor-property',
      optional([
        ref('separation-characters', { n, c }),
        'tag-property',
      ]),
    ],
    [
      'tag-property',
      optional([
        ref('separation-characters', { n, c }),
        'anchor-property',
      ]),
    ],
  ),

  /* 139 */ 'anchor-property': [
    str('&'),
    'anchor-name',
  ],

  /* 140 */ 'anchor-name': plus('anchor-character'),

  /* 141 */ 'anchor-character': ANCHOR_CHARACTER,

  /* 142 */ 'tag-property': first(
    'verbatim-tag',
    'shorthand-tag',
    'non-specific-tag',
  ),

  /* 143 */ 'verbatim-tag': [
    str('!<'),
    plus('uri-character'),
    str('>'),
  ],

  /* 144 */ 'shorthand-tag': [
    'tag-handle',
    plus('tag-character'),
  ],

  /* 145 */ 'non-specific-tag': str('!'),

  /* 146 */ 'byte-order-mark': BYTE_ORDER_MARK,

  /* 147 */ 'yaml-character': YAML_CHARACTER,

  /* 148 */ 'json-character': JSON_CHARACTER,

  /* 149 */ 'non-space-character': NON_SPACE_CHARACTER,

  /* 150 */ 'non-break-character': NON_BREAK_CHARACTER,

  /* 151 */ 'blank-character': BLANK_CHARACTER,

  /* 151 */ 'space-character': new CharSet(0x20),

  /* 153 */ 'line-ending': first(
    'line-break',
    endOfInput,
  ),

  /* 154 */ 'break-as-space': 'line-break',
  
  /* 155 */ 'break-as-line-feed': 'line-break',

  /* 156 */ 'line-break': first(
    str('\r\n'),
    str('\r'),
    str('\n'),
  ),

  /* 157 */ 'flow-collection-indicators': new CharSet(',', '{', '}', '[', ']'),

  /* 158 */ 'double-quoted-scalar-escape-character': [
    str('\\'),
    first(
      str('0'),
      str('a'),
      str('b'),
      str('t'),
      str('\t'),
      str('n'),
      str('v'),
      str('f'),
      str('r'),
      str('e'),
      str(' '),
      str('"'),
      str('/'),
      str('\\'),
      str('N'),
      str('_'),
      str('L'),
      str('P'),
      [ str('x'), repeat('hexadecimal-digit', 2, 2) ],
      [ str('u'), repeat('hexadecimal-digit', 4, 4) ],
      [ str('U'), repeat('hexadecimal-digit', 8, 8) ],
    ),
  ],

  /* 159 */ 'tag-character': [
    negativeLookahead(str('!')),
    negativeLookahead('flow-collection-indicators'),
    'uri-character',
  ],

  /* 160 */ 'uri-character': first(
    [ str('%'), repeat('hexadecimal-digit', 2, 2)],
    'word-character',
    new CharSet(
      '#', ';', '/', '?', ':', '@', '&', '=', '+', '$',
      ',', '_', '.', '!', '~', '*', '\'', '(', ')', '[', ']',
    ),
  ),

  /* 161 */ 'word-character': first(
    'decimal-digit',
    'ascii-alpha-character',
    str('-'),
  ),
  
  /* 162 */ 'hexadecimal-digit': HEXADECIMAL_DIGIT,

  /* 163 */ 'decimal-digit': DECIMAL_DIGIT,

  /* 164 */ 'decimal-digit-1-9': DECIMAL_DIGIT_1_9,

  /* 165 */ 'ascii-alpha-character': ASCII_ALPHA_CHARACTER,
};

const PATCHES: Grammar = {
  // Avoid unbounded repetition
  /* 2 */ 'document-prefix': first('byte-order-mark', 'blanks-and-comment-line'),

  /* 15 */ 'block-collection': ({ n, c }) => [
    optional([
      ref('separation-characters', { n: n + 1, c }),
      ref('block-collection-node-properties', { n: n + 1, c }),
    ]),
    'comment-lines',
    first(
      ref('block-sequence-context', { n, c }),
      ref('block-mapping', { n }),
    ),
  ],

  'block-collection-node-properties': ({ n, c }) => [
    first('anchor-property', 'tag-property'),
    first(
      [
        ref('separation-characters', { n, c }),
        ref('block-collection-node-properties', { n, c }),
      ],
      lookahead('comment-line'),
    ),
  ],

  /* 44 */ 'block-scalar-indicators': ({ t }) => [
    first(
      [
        'block-scalar-indentation-indicator',
        ref('block-scalar-chomping-indicator', { t }),
      ],
      [
        ref('block-scalar-chomping-indicator', { t }),
        optional('block-scalar-indentation-indicator'),
      ],
    ),
    'comment-line',
  ],

  /* 60 */ 'flow-mapping-implicit-entry': ({ n, c }) => first(
    ref('flow-mapping-json-key-entry', { n, c }),
    ref('flow-mapping-yaml-key-entry', { n, c }),
    ref('flow-mapping-empty-key-entry', { n, c }),
  ),
};

// const SIMPLE_DIRECTIVES: Grammar = {
//   /* 10 */ 'directive-line': [
//     str('%'),
//     'directive-name',
//     star([
//       'separation-blanks',
//       'directive-parameter',
//     ]),
//     'comment-lines',
//   ],
// };

const NO_LOOKBEHIND: Grammar = {
  /* 100 */ 'plain-scalar-next-line': ({ n, c }) => [
    ref('flow-folded-whitespace', { n }),
    negativeLookahead('forbidden-content'), // TODO
    negativeLookahead(str('#')),
    ref('plain-scalar-characters', { c }),
    ref('plain-scalar-line-characters', { c }),
  ],

  /* 101 */ 'plain-scalar-line-characters': ({ c }) =>
    star([
      star('blank-character'),
      negativeLookahead(str('#')),
      plus(ref('plain-scalar-characters', { c })),
    ]),

  /* 103 */ 'plain-scalar-characters': ({ c }) => first(
    [
      negativeLookahead(new CharSet(':')),
      ref('non-space-plain-scalar-character', { c }),
    ],
    [
      str(':'),
      lookahead(ref('non-space-plain-scalar-character', { c }))
    ],
  ),
};

const ANNOTATION_INDICATORS = new CharSet('(', ')');

const ANNOTATIONS: Grammar = {
  'block-collection-node-properties': ({ n, c }) => [
    first(ref('annotation-property', { n, c }), 'anchor-property', 'tag-property'),
    first(
      [
        ref('separation-characters', { n, c }),
        ref('block-collection-node-properties', { n, c }),
      ],
      lookahead('comment-line'),
    ),
  ],

  /* 87 */ 'flow-sequence-context': ({ n, c }) => context(c, {
    'FLOW-OUT': ref('flow-sequence-entries', { n, c: 'FLOW-IN' }),
    'FLOW-IN' : ref('flow-sequence-entries', { n, c: 'FLOW-IN' }),
    'BLOCK-KEY': ref('flow-sequence-entries', { n, c: 'FLOW-KEY' }),
    'FLOW-KEY' : ref('flow-sequence-entries', { n, c: 'FLOW-KEY' }),
    'ANNOTATION-IN' : ref('flow-sequence-entries', { n, c: 'ANNOTATION-IN' }),
  }),

  /* 97 */ 'flow-plain-scalar': ({ n, c }) => context(c, {
    'FLOW-OUT': ref('plain-scalar-multi-line', { n, c: 'FLOW-OUT' }),
    'FLOW-IN': ref('plain-scalar-multi-line', { n, c: 'FLOW-IN' }),
    'BLOCK-KEY': ref('plain-scalar-single-line', { c: 'BLOCK-KEY' }),
    'FLOW-KEY': ref('plain-scalar-single-line', { c: 'FLOW-KEY' }),
    'ANNOTATION-IN': ref('plain-scalar-multi-line', { n, c: 'ANNOTATION-IN' }),
  }),

  /* 104 */ 'non-space-plain-scalar-character': ({ c }) => context(c, {
    'FLOW-OUT': 'block-plain-scalar-character',
    'FLOW-IN': 'flow-plain-scalar-character',
    'BLOCK-KEY': 'block-plain-scalar-character',
    'FLOW-KEY': 'flow-plain-scalar-character',
    'ANNOTATION-IN': 'annotation-plain-scalar-character',
  }),

  /* 122 */ 'separation-characters': ({ n, c }) => context(c, {
    'BLOCK-OUT': ref('separation-lines', { n }),
    'BLOCK-IN': ref('separation-lines', { n }),
    'FLOW-OUT': ref('separation-lines', { n }),
    'FLOW-IN': ref('separation-lines', { n }),
    'ANNOTATION-IN': ref('separation-lines', { n }),
    'BLOCK-KEY': 'separation-blanks',
    'FLOW-KEY': 'separation-blanks',
  }),

  'annotation-plain-scalar-character': NON_SPACE_CHARACTER
    .minus(FLOW_COLLECTION_INDICATORS)
    .minus(ANNOTATION_INDICATORS),

  'node-properties': ({ n, c }) => [
    first(ref('annotation-property', { n, c }), 'anchor-property', 'tag-property'),
    optional([
      ref('separation-characters', { n, c }),
      ref('node-properties', { n, c }),
    ]),
  ],

  'annotation-property': ({ n, c}) => [
    str('@'),
    'annotation-name',
    optional(ref('annotation-arguments', { n, c })),
  ],

  'annotation-name': plus(ANCHOR_CHARACTER.minus(new CharSet('(', ')'))),

  'annotation-arguments': ({ n }) => [
    str('('),
    optional('separation-characters'),
    optional(ref('flow-sequence-context', { n, c: 'ANNOTATION-IN' })),
    str(')'),
  ],
};

export const GRAMMAR = {
  ...BASE_GRAMMAR,
  ...PATCHES,
  ...NO_LOOKBEHIND,
  ...ANNOTATIONS,
};
