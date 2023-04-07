import {
  ref,
  sequence,
  first,
  plus,
  detectIndentation,

  type Grammar,
} from '../core/helpers';

import { ChompingBehavior } from '../core/ast';

import { parseGrammar } from '../core/metaGrammar';

const GENERATED_BASE = parseGrammar(String.raw`
[1] c-printable ::=
                         # 8 bit
    x09                  # Tab (\t)
  | x0A                  # Line feed (LF \n)
  | x0D                  # Carriage Return (CR \r)
  | [x20-x7E]            # Printable ASCII
                         # 16 bit
  | x85                  # Next Line (NEL)
  | [xA0-xD7FF]          # Basic Multilingual Plane (BMP)
  | [xE000-xFFFD]        # Additional Unicode Areas
  | [x010000-x10FFFF]    # 32 bit

[2] nb-json ::=
    x09              # Tab character
  | [x20-x10FFFF]    # Non-C0-control characters

[3] c-byte-order-mark ::= xFEFF

[4] c-sequence-entry ::= '-'

[5] c-mapping-key ::= '?'

[6] c-mapping-value ::= ':'

[7] c-collect-entry ::= ','

[8] c-sequence-start ::= '['

[9] c-sequence-end ::= ']'

[10] c-mapping-start ::= '{'

[11] c-mapping-end ::= '}'

[12] c-comment ::= '#'

[13] c-anchor ::= '&'

[14] c-alias ::= '*'

[15] c-tag ::= '!'

[16] c-literal ::= '|'

[17] c-folded ::= '>'

[18] c-single-quote ::= "'"

[19] c-double-quote ::= '"'

[20] c-directive ::= '%'

[21] c-reserved ::=
    '@' | '${'`'}'

[22] c-indicator ::=
    c-sequence-entry    # '-'
  | c-mapping-key       # '?'
  | c-mapping-value     # ':'
  | c-collect-entry     # ','
  | c-sequence-start    # '['
  | c-sequence-end      # ']'
  | c-mapping-start     # '{'
  | c-mapping-end       # '}'
  | c-comment           # '#'
  | c-anchor            # '&'
  | c-alias             # '*'
  | c-tag               # '!'
  | c-literal           # '|'
  | c-folded            # '>'
  | c-single-quote      # "'"
  | c-double-quote      # '"'
  | c-directive         # '%'
  | c-reserved          # '@' '${'`'}'

[23] c-flow-indicator ::=
    c-collect-entry     # ','
  | c-sequence-start    # '['
  | c-sequence-end      # ']'
  | c-mapping-start     # '{'
  | c-mapping-end       # '}'

[24] b-line-feed ::= x0A

[25] b-carriage-return ::= x0D

[26] b-char ::=
    b-line-feed          # x0A
  | b-carriage-return    # X0D

[27] nb-char ::=
  c-printable - b-char - c-byte-order-mark

[28] b-break ::=
    (
      b-carriage-return  # x0A
      b-line-feed
    )                    # x0D
  | b-carriage-return
  | b-line-feed

[29] b-as-line-feed ::=
  b-break

[30] b-non-content ::=
  b-break

[31] s-space ::= x20

[32] s-tab ::= x09

[33] s-white ::=
  s-space | s-tab

[34] ns-char ::=
  nb-char - s-white

[35] ns-dec-digit ::=
  [x30-x39]             # 0-9

[36] ns-hex-digit ::=
    ns-dec-digit        # 0-9
  | [x41-x46]           # A-F
  | [x61-x66]           # a-f

[37] ns-ascii-letter ::=
    [x41-x5A]           # A-Z
  | [x61-x7A]           # a-z

[38] ns-word-char ::=
    ns-dec-digit        # 0-9
  | ns-ascii-letter     # A-Z a-z
  | '-'                 # '-'

[39] ns-uri-char ::=
    (
      '%'
      ns-hex-digit{2}
    )
  | ns-word-char
  | '#'
  | ';'
  | '/'
  | '?'
  | ':'
  | '@'
  | '&'
  | '='
  | '+'
  | '$'
  | ','
  | '_'
  | '.'
  | '!'
  | '~'
  | '*'
  | "'"
  | '('
  | ')'
  | '['
  | ']'

[40] ns-tag-char ::=
    ns-uri-char
  - c-tag               # '!'
  - c-flow-indicator

[41] c-escape ::= '\'

[42] ns-esc-null ::= '0'

[43] ns-esc-bell ::= 'a'

[44] ns-esc-backspace ::= 'b'

[45] ns-esc-horizontal-tab ::=
  't' | x09

[46] ns-esc-line-feed ::= 'n'

[47] ns-esc-vertical-tab ::= 'v'

[48] ns-esc-form-feed ::= 'f'

[49] ns-esc-carriage-return ::= 'r'

[50] ns-esc-escape ::= 'e'

[51] ns-esc-space ::= x20

[52] ns-esc-double-quote ::= '"'

[53] ns-esc-slash ::= '/'

[54] ns-esc-backslash ::= '\'

[55] ns-esc-next-line ::= 'N'

[56] ns-esc-non-breaking-space ::= '_'

[57] ns-esc-line-separator ::= 'L'

[58] ns-esc-paragraph-separator ::= 'P'

[59] ns-esc-8-bit ::=
  'x'
  ns-hex-digit{2}

[60] ns-esc-16-bit ::=
  'u'
  ns-hex-digit{4}

[61] ns-esc-32-bit ::=
  'U'
  ns-hex-digit{8}

[62] c-ns-esc-char ::=
  c-escape         # '\'
  (
      ns-esc-null
    | ns-esc-bell
    | ns-esc-backspace
    | ns-esc-horizontal-tab
    | ns-esc-line-feed
    | ns-esc-vertical-tab
    | ns-esc-form-feed
    | ns-esc-carriage-return
    | ns-esc-escape
    | ns-esc-space
    | ns-esc-double-quote
    | ns-esc-slash
    | ns-esc-backslash
    | ns-esc-next-line
    | ns-esc-non-breaking-space
    | ns-esc-line-separator
    | ns-esc-paragraph-separator
    | ns-esc-8-bit
    | ns-esc-16-bit
    | ns-esc-32-bit
  )

[63]
s-indent(0) ::=
  <empty>

# When n≥0
s-indent(n+1) ::=
  s-space s-indent(n)

[64]
s-indent-less-than(1) ::=
  <empty>

# When n≥1
s-indent-less-than(n+1) ::=
  s-space s-indent-less-than(n)
  | <empty>

[65]
s-indent-less-or-equal(0) ::=
  <empty>

# When n≥0
s-indent-less-or-equal(n+1) ::=
  s-space s-indent-less-or-equal(n)
  | <empty>

[66] s-separate-in-line ::=
    s-white+
  | <start-of-line>

[67]
s-line-prefix(n,BLOCK-OUT) ::= s-block-line-prefix(n)
s-line-prefix(n,BLOCK-IN)  ::= s-block-line-prefix(n)
s-line-prefix(n,FLOW-OUT)  ::= s-flow-line-prefix(n)
s-line-prefix(n,FLOW-IN)   ::= s-flow-line-prefix(n)

[68] s-block-line-prefix(n) ::=
  s-indent(n)

[69] s-flow-line-prefix(n) ::=
  s-indent(n)
  s-separate-in-line?

[70] l-empty(n,c) ::=
  (
      s-line-prefix(n,c)
    | s-indent-less-than(n)
  )
  b-as-line-feed

[71] b-l-trimmed(n,c) ::=
  b-non-content
  l-empty(n,c)+

[72] b-as-space ::=
  b-break

[73] b-l-folded(n,c) ::=
  b-l-trimmed(n,c) | b-as-space

[74] s-flow-folded(n) ::=
  s-separate-in-line?
  b-l-folded(n,FLOW-IN)
  s-flow-line-prefix(n)

[75] c-nb-comment-text ::=
  c-comment    # '#'
  nb-char*

[76] b-comment ::=
    b-non-content
  | <end-of-input>

[77] s-b-comment ::=
  (
    s-separate-in-line
    c-nb-comment-text?
  )?
  b-comment

[78] l-comment ::=
  s-separate-in-line
  c-nb-comment-text?
  b-comment

[79] s-l-comments ::=
  (
      s-b-comment
    | <start-of-line>
  )
  l-comment*

[80]
s-separate(n,BLOCK-OUT) ::= s-separate-lines(n)
s-separate(n,BLOCK-IN)  ::= s-separate-lines(n)
s-separate(n,FLOW-OUT)  ::= s-separate-lines(n)
s-separate(n,FLOW-IN)   ::= s-separate-lines(n)
s-separate(n,BLOCK-KEY) ::= s-separate-in-line
s-separate(n,FLOW-KEY)  ::= s-separate-in-line

[81] s-separate-lines(n) ::=
    (
      s-l-comments
      s-flow-line-prefix(n)
    )
  | s-separate-in-line

[82] l-directive ::=
  c-directive            # '%'
  (
      ns-yaml-directive
    | ns-tag-directive
    | ns-reserved-directive
  )
  s-l-comments

[83] ns-reserved-directive ::=
  ns-directive-name
  (
    s-separate-in-line
    ns-directive-parameter
  )*

[84] ns-directive-name ::=
  ns-char+

[85] ns-directive-parameter ::=
  ns-char+

[86] ns-yaml-directive ::=
  "YAML"
  s-separate-in-line
  ns-yaml-version

[87] ns-yaml-version ::=
  ns-dec-digit+
  '.'
  ns-dec-digit+

[88] ns-tag-directive ::=
  "TAG"
  s-separate-in-line
  c-tag-handle
  s-separate-in-line
  ns-tag-prefix

[89] c-tag-handle ::=
    c-named-tag-handle
  | c-secondary-tag-handle
  | c-primary-tag-handle

[90] c-primary-tag-handle ::= '!'

[91] c-secondary-tag-handle ::= "!!"

[92] c-named-tag-handle ::=
  c-tag            # '!'
  ns-word-char+
  c-tag            # '!'

[93] ns-tag-prefix ::=
  c-ns-local-tag-prefix | ns-global-tag-prefix

[94] c-ns-local-tag-prefix ::=
  c-tag           # '!'
  ns-uri-char*

[95] ns-global-tag-prefix ::=
  ns-tag-char
  ns-uri-char*

[96] c-ns-properties(n,c) ::=
    (
      c-ns-tag-property
      (
        s-separate(n,c)
        c-ns-anchor-property
      )?
    )
  | (
      c-ns-anchor-property
      (
        s-separate(n,c)
        c-ns-tag-property
      )?
    )

[97] c-ns-tag-property ::=
    c-verbatim-tag
  | c-ns-shorthand-tag
  | c-non-specific-tag

[98] c-verbatim-tag ::=
  "!<"
  ns-uri-char+
  '>'

[99] c-ns-shorthand-tag ::=
  c-tag-handle
  ns-tag-char+

[100] c-non-specific-tag ::= '!'

[101] c-ns-anchor-property ::=
  c-anchor          # '&'
  ns-anchor-name

[102] ns-anchor-char ::=
    ns-char - c-flow-indicator

[103] ns-anchor-name ::=
  ns-anchor-char+

[104] c-ns-alias-node ::=
  c-alias           # '*'
  ns-anchor-name

[105] e-scalar ::= ""

[106] e-node ::=
  e-scalar    # ""

[107] nb-double-char ::=
    c-ns-esc-char
  | (
        nb-json
      - c-escape          # '\'
      - c-double-quote    # '"'
    )

[108] ns-double-char ::=
  nb-double-char - s-white

[109] c-double-quoted(n,c) ::=
  c-double-quote         # '"'
  nb-double-text(n,c)
  c-double-quote         # '"'

[110]
nb-double-text(n,FLOW-OUT)  ::= nb-double-multi-line(n)
nb-double-text(n,FLOW-IN)   ::= nb-double-multi-line(n)
nb-double-text(n,BLOCK-KEY) ::= nb-double-one-line
nb-double-text(n,FLOW-KEY)  ::= nb-double-one-line

[111] nb-double-one-line ::=
  nb-double-char*

[112] s-double-escaped(n) ::=
  s-white*
  c-escape         # '\'
  b-non-content
  l-empty(n,FLOW-IN)*
  s-flow-line-prefix(n)

[113] s-double-break(n) ::=
    s-double-escaped(n)
  | s-flow-folded(n)

[114] nb-ns-double-in-line ::=
  (
    s-white*
    ns-double-char
  )*

[115] s-double-next-line(n) ::=
  s-double-break(n)
  (
    ns-double-char nb-ns-double-in-line
    (
        s-double-next-line(n)
      | s-white*
    )
  )?

[116] nb-double-multi-line(n) ::=
  nb-ns-double-in-line
  (
      s-double-next-line(n)
    | s-white*
  )

[117] c-quoted-quote ::= "''"

[118] nb-single-char ::=
    c-quoted-quote
  | (
        nb-json
      - c-single-quote    # "'"
    )

[119] ns-single-char ::=
  nb-single-char - s-white

[120] c-single-quoted(n,c) ::=
  c-single-quote    # "'"
  nb-single-text(n,c)
  c-single-quote    # "'"

[121]
nb-single-text(FLOW-OUT)  ::= nb-single-multi-line(n)
nb-single-text(FLOW-IN)   ::= nb-single-multi-line(n)
nb-single-text(BLOCK-KEY) ::= nb-single-one-line
nb-single-text(FLOW-KEY)  ::= nb-single-one-line

[122] nb-single-one-line ::=
  nb-single-char*

[123] nb-ns-single-in-line ::=
  (
    s-white*
    ns-single-char
  )*

[124] s-single-next-line(n) ::=
  s-flow-folded(n)
  (
    ns-single-char
    nb-ns-single-in-line
    (
        s-single-next-line(n)
      | s-white*
    )
  )?

[125] nb-single-multi-line(n) ::=
  nb-ns-single-in-line
  (
      s-single-next-line(n)
    | s-white*
  )

[126] ns-plain-first(c) ::=
    (
        ns-char
      - c-indicator
    )
  | (
      (
          c-mapping-key       # '?'
        | c-mapping-value     # ':'
        | c-sequence-entry    # '-'
      )
      [ lookahead = ns-plain-safe(c) ]
    )

[127]
ns-plain-safe(FLOW-OUT)  ::= ns-plain-safe-out
ns-plain-safe(FLOW-IN)   ::= ns-plain-safe-in
ns-plain-safe(BLOCK-KEY) ::= ns-plain-safe-out
ns-plain-safe(FLOW-KEY)  ::= ns-plain-safe-in

[128] ns-plain-safe-out ::=
  ns-char

[129] ns-plain-safe-in ::=
  ns-char - c-flow-indicator

[130] ns-plain-char(c) ::=
    (
        ns-plain-safe(c)
      - c-mapping-value    # ':'
      - c-comment          # '#'
    )
  | (
      [ lookbehind = ns-char ]
      c-comment          # '#'
    )
  | (
      c-mapping-value    # ':'
      [ lookahead = ns-plain-safe(c) ]
    )

[131]
ns-plain(n,FLOW-OUT)  ::= ns-plain-multi-line(n,FLOW-OUT)
ns-plain(n,FLOW-IN)   ::= ns-plain-multi-line(n,FLOW-IN)
ns-plain(n,BLOCK-KEY) ::= ns-plain-one-line(BLOCK-KEY)
ns-plain(n,FLOW-KEY)  ::= ns-plain-one-line(FLOW-KEY)

[132] nb-ns-plain-in-line(c) ::=
  (
    s-white*
    ns-plain-char(c)
  )*

[133] ns-plain-one-line(c) ::=
  ns-plain-first(c)
  nb-ns-plain-in-line(c)

[134] s-ns-plain-next-line(n,c) ::=
  s-flow-folded(n)
  ns-plain-char(c)
  nb-ns-plain-in-line(c)

[135] ns-plain-multi-line(n,c) ::=
  ns-plain-one-line(c)
  s-ns-plain-next-line(n,c)*

[136]
in-flow(n,FLOW-OUT)  ::= ns-s-flow-seq-entries(n,FLOW-IN)
in-flow(n,FLOW-IN)   ::= ns-s-flow-seq-entries(n,FLOW-IN)
in-flow(n,BLOCK-KEY) ::= ns-s-flow-seq-entries(n,FLOW-KEY)
in-flow(n,FLOW-KEY)  ::= ns-s-flow-seq-entries(n,FLOW-KEY)

[137] c-flow-sequence(n,c) ::=
  c-sequence-start    # '['
  s-separate(n,c)?
  in-flow(n,c)?
  c-sequence-end      # ']'

[138] ns-s-flow-seq-entries(n,c) ::=
  ns-flow-seq-entry(n,c)
  s-separate(n,c)?
  (
    c-collect-entry     # ','
    s-separate(n,c)?
    ns-s-flow-seq-entries(n,c)?
  )?

[139] ns-flow-seq-entry(n,c) ::=
  ns-flow-pair(n,c) | ns-flow-node(n,c)

[140] c-flow-mapping(n,c) ::=
  c-mapping-start       # '{'
  s-separate(n,c)?
  ns-s-flow-map-entries(n,in-flow(c))?
  c-mapping-end         # '}'

[141] ns-s-flow-map-entries(n,c) ::=
  ns-flow-map-entry(n,c)
  s-separate(n,c)?
  (
    c-collect-entry     # ','
    s-separate(n,c)?
    ns-s-flow-map-entries(n,c)?
  )?

[142] ns-flow-map-entry(n,c) ::=
    (
      c-mapping-key    # '?' (not followed by non-ws char)
      s-separate(n,c)
      ns-flow-map-explicit-entry(n,c)
    )
  | ns-flow-map-implicit-entry(n,c)

[143] ns-flow-map-explicit-entry(n,c) ::=
    ns-flow-map-implicit-entry(n,c)
  | (
      e-node    # ""
      e-node    # ""
    )

[144] ns-flow-map-implicit-entry(n,c) ::=
    ns-flow-map-yaml-key-entry(n,c)
  | c-ns-flow-map-empty-key-entry(n,c)
  | c-ns-flow-map-json-key-entry(n,c)

[145] ns-flow-map-yaml-key-entry(n,c) ::=
  ns-flow-yaml-node(n,c)
  (
      (
        s-separate(n,c)?
        c-ns-flow-map-separate-value(n,c)
      )
    | e-node    # ""
  )

[146] c-ns-flow-map-empty-key-entry(n,c) ::=
  e-node    # ""
  c-ns-flow-map-separate-value(n,c)

[147] c-ns-flow-map-separate-value(n,c) ::=
  c-mapping-value    # ':'
  [ lookahead ≠ ns-plain-safe(c) ]
  (
      (
        s-separate(n,c)
        ns-flow-node(n,c)
      )
    | e-node    # ""
  )

[148] c-ns-flow-map-json-key-entry(n,c) ::=
  c-flow-json-node(n,c)
  (
      (
        s-separate(n,c)?
        c-ns-flow-map-adjacent-value(n,c)
      )
    | e-node    # ""
  )

[149] c-ns-flow-map-adjacent-value(n,c) ::=
  c-mapping-value          # ':'
  (
      (
        s-separate(n,c)?
        ns-flow-node(n,c)
      )
    | e-node    # ""
  )

[150] ns-flow-pair(n,c) ::=
    (
      c-mapping-key     # '?' (not followed by non-ws char)
      s-separate(n,c)
      ns-flow-map-explicit-entry(n,c)
    )
  | ns-flow-pair-entry(n,c)

[151] ns-flow-pair-entry(n,c) ::=
    ns-flow-pair-yaml-key-entry(n,c)
  | c-ns-flow-map-empty-key-entry(n,c)
  | c-ns-flow-pair-json-key-entry(n,c)

[152] ns-flow-pair-yaml-key-entry(n,c) ::=
  ns-s-implicit-yaml-key(FLOW-KEY)
  c-ns-flow-map-separate-value(n,c)

[153] c-ns-flow-pair-json-key-entry(n,c) ::=
  c-s-implicit-json-key(FLOW-KEY)
  c-ns-flow-map-adjacent-value(n,c)

[154] ns-s-implicit-yaml-key(c) ::=
  ns-flow-yaml-node(0,c)
  s-separate-in-line?
  /* At most 1024 characters altogether */

[155] c-s-implicit-json-key(c) ::=
  c-flow-json-node(0,c)
  s-separate-in-line?
  /* At most 1024 characters altogether */

[156] ns-flow-yaml-content(n,c) ::=
  ns-plain(n,c)

[157] c-flow-json-content(n,c) ::=
    c-flow-sequence(n,c)
  | c-flow-mapping(n,c)
  | c-single-quoted(n,c)
  | c-double-quoted(n,c)

[158] ns-flow-content(n,c) ::=
    ns-flow-yaml-content(n,c)
  | c-flow-json-content(n,c)

[159] ns-flow-yaml-node(n,c) ::=
    c-ns-alias-node
  | ns-flow-yaml-content(n,c)
  | (
      c-ns-properties(n,c)
      (
          (
            s-separate(n,c)
            ns-flow-yaml-content(n,c)
          )
        | e-scalar
      )
    )

[160] c-flow-json-node(n,c) ::=
  (
    c-ns-properties(n,c)
    s-separate(n,c)
  )?
  c-flow-json-content(n,c)

[161] ns-flow-node(n,c) ::=
    c-ns-alias-node
  | ns-flow-content(n,c)
  | (
      c-ns-properties(n,c)
      (
        (
          s-separate(n,c)
          ns-flow-content(n,c)
        )
        | e-scalar
      )
    )

[162] c-b-block-header(t) ::=
  (
      (
        c-indentation-indicator
        c-chomping-indicator(t)
      )
    | (
        c-chomping-indicator(t)
        c-indentation-indicator
      )
  )
  s-b-comment

[163] c-indentation-indicator ::=
  [x31-x39]    # 1-9

[164]
c-chomping-indicator(STRIP) ::= '-'
c-chomping-indicator(KEEP)  ::= '+'
c-chomping-indicator(CLIP)  ::= ""

[165]
b-chomped-last(STRIP) ::= b-non-content  | <end-of-input>
b-chomped-last(CLIP)  ::= b-as-line-feed | <end-of-input>
b-chomped-last(KEEP)  ::= b-as-line-feed | <end-of-input>

[166]
l-chomped-empty(n,STRIP) ::= l-strip-empty(n)
l-chomped-empty(n,CLIP)  ::= l-strip-empty(n)
l-chomped-empty(n,KEEP)  ::= l-keep-empty(n)

[167] l-strip-empty(n) ::=
  (
    s-indent-less-or-equal(n)
    b-non-content
  )*
  l-trail-comments(n)?

[168] l-keep-empty(n) ::=
  l-empty(n,BLOCK-IN)*
  l-trail-comments(n)?

[169] l-trail-comments(n) ::=
  s-indent-less-than(n)
  c-nb-comment-text
  b-comment
  l-comment*

[170] c-l+literal(n) ::=
  c-literal                # '|'
  c-b-block-header(t)
  l-literal-content(n+m,t)

[171] l-nb-literal-text(n) ::=
  l-empty(n,BLOCK-IN)*
  s-indent(n) nb-char+

[172] b-nb-literal-next(n) ::=
  b-as-line-feed
  l-nb-literal-text(n)

[173] l-literal-content(n,t) ::=
  (
    l-nb-literal-text(n)
    b-nb-literal-next(n)*
    b-chomped-last(t)
  )?
  l-chomped-empty(n,t)

[174] c-l+folded(n) ::=
  c-folded                 # '>'
  c-b-block-header(t)
  l-folded-content(n+m,t)

[175] s-nb-folded-text(n) ::=
  s-indent(n)
  ns-char
  nb-char*

[176] l-nb-folded-lines(n) ::=
  s-nb-folded-text(n)
  (
    b-l-folded(n,BLOCK-IN)
    s-nb-folded-text(n)
  )*

[177] s-nb-spaced-text(n) ::=
  s-indent(n)
  s-white
  nb-char*

[178] b-l-spaced(n) ::=
  b-as-line-feed
  l-empty(n,BLOCK-IN)*

[179] l-nb-spaced-lines(n) ::=
  s-nb-spaced-text(n)
  (
    b-l-spaced(n)
    s-nb-spaced-text(n)
  )*

[180] l-nb-same-lines(n) ::=
  l-empty(n,BLOCK-IN)*
  (
      l-nb-folded-lines(n)
    | l-nb-spaced-lines(n)
  )

[181] l-nb-diff-lines(n) ::=
  l-nb-same-lines(n)
  (
    b-as-line-feed
    l-nb-same-lines(n)
  )*

[182] l-folded-content(n,t) ::=
  (
    l-nb-diff-lines(n)
    b-chomped-last(t)
  )?
  l-chomped-empty(n,t)

[183] l+block-sequence(n) ::=
  (
    s-indent(n+1+m)
    c-l-block-seq-entry(n+1+m)
  )+

[184] c-l-block-seq-entry(n) ::=
  c-sequence-entry    # '-'
  [ lookahead ≠ ns-char ]
  s-l+block-indented(n,BLOCK-IN)

[185] s-l+block-indented(n,c) ::=
    (
      s-indent(m)
      (
          ns-l-compact-sequence(n+1+m)
        | ns-l-compact-mapping(n+1+m)
      )
    )
  | s-l+block-node(n,c)
  | (
      e-node    # ""
      s-l-comments
    )

[186] ns-l-compact-sequence(n) ::=
  c-l-block-seq-entry(n)
  (
    s-indent(n)
    c-l-block-seq-entry(n)
  )*

[187] l+block-mapping(n) ::=
  (
    s-indent(n+1+m)
    ns-l-block-map-entry(n+1+m)
  )+

[188] ns-l-block-map-entry(n) ::=
    c-l-block-map-explicit-entry(n)
  | ns-l-block-map-implicit-entry(n)

[189] c-l-block-map-explicit-entry(n) ::=
  c-l-block-map-explicit-key(n)
  (
      l-block-map-explicit-value(n)
    | e-node                        # ""
  )

[190] c-l-block-map-explicit-key(n) ::=
  c-mapping-key                     # '?' (not followed by non-ws char)
  s-l+block-indented(n,BLOCK-OUT)

[191] l-block-map-explicit-value(n) ::=
  s-indent(n)
  c-mapping-value                   # ':' (not followed by non-ws char)
  s-l+block-indented(n,BLOCK-OUT)

[192] ns-l-block-map-implicit-entry(n) ::=
  (
      ns-s-block-map-implicit-key
    | e-node    # ""
  )
  c-l-block-map-implicit-value(n)

[193] ns-s-block-map-implicit-key ::=
    c-s-implicit-json-key(BLOCK-KEY)
  | ns-s-implicit-yaml-key(BLOCK-KEY)

[194] c-l-block-map-implicit-value(n) ::=
  c-mapping-value           # ':' (not followed by non-ws char)
  (
      s-l+block-node(n,BLOCK-OUT)
    | (
        e-node    # ""
        s-l-comments
      )
  )

[195] ns-l-compact-mapping(n) ::=
  ns-l-block-map-entry(n)
  (
    s-indent(n)
    ns-l-block-map-entry(n)
  )*

[196] s-l+block-node(n,c) ::=
    s-l+block-in-block(n,c)
  | s-l+flow-in-block(n)

[197] s-l+flow-in-block(n) ::=
  s-separate(n+1,FLOW-OUT)
  ns-flow-node(n+1,FLOW-OUT)
  s-l-comments

[198] s-l+block-in-block(n,c) ::=
    s-l+block-scalar(n,c)
  | s-l+block-collection(n,c)

[199] s-l+block-scalar(n,c) ::=
  s-separate(n+1,c)
  (
    c-ns-properties(n+1,c)
    s-separate(n+1,c)
  )?
  (
      c-l+literal(n)
    | c-l+folded(n)
  )

[200] s-l+block-collection(n,c) ::=
  (
    s-separate(n+1,c)
    c-ns-properties(n+1,c)
  )?
  s-l-comments
  (
      seq-space(n,c)
    | l+block-mapping(n)
  )

[201] seq-space(n,BLOCK-OUT) ::= l+block-sequence(n-1)
    seq-space(n,BLOCK-IN)  ::= l+block-sequence(n)

[202] l-document-prefix ::=
  c-byte-order-mark?
  l-comment*

[203] c-directives-end ::= "---"

[204] c-document-end ::=
  "..."    # (not followed by non-ws char)

[205] l-document-suffix ::=
  c-document-end
  s-l-comments

[206] c-forbidden ::=
  <start-of-line>
  (
      c-directives-end
    | c-document-end
  )
  (
      b-char
    | s-white
    | <end-of-input>
  )

[207] l-bare-document ::=
  s-l+block-node(-1,BLOCK-IN)
  /* Excluding c-forbidden content */

[208] l-explicit-document ::=
  c-directives-end
  (
      l-bare-document
    | (
        e-node    # ""
        s-l-comments
      )
  )

[209] l-directive-document ::=
  l-directive+
  l-explicit-document

[210] l-any-document ::=
    l-directive-document
  | l-explicit-document
  | l-bare-document

[211] l-yaml-stream ::=
  l-document-prefix*
  l-any-document?
  (
      (
        l-document-suffix+
        l-document-prefix*
        l-any-document?
      )
    | c-byte-order-mark
    | l-comment
    | l-explicit-document
  )*
`);

const FORBIDDEN_CONTENT = parseGrammar(String.raw`
[171]
l-nb-literal-text(n) ::=
  l-empty(n,BLOCK-IN)*
  [ lookahead ≠ c-forbidden ]
  s-indent(n)
  nb-char+

[175]
s-nb-folded-text(n) ::=
  [ lookahead ≠ c-forbidden ]
  s-indent(n)
  ns-char
  nb-char*

[133]
ns-plain-one-line(c) ::=
  [ lookahead ≠ c-forbidden ]
  ns-plain-first(c)
  nb-ns-plain-in-line(c)

[134]
s-ns-plain-next-line(n,c) ::=
  s-flow-folded(n)
  [ lookahead ≠ c-forbidden ]
  ns-plain-char(c)
  nb-ns-plain-in-line(c)
`);

const INTRODUCE_T = parseGrammar(String.raw`
[17] c-l+literal(n) ::=
  ${Object.values(ChompingBehavior).map(t => `(
    c-literal
    c-b-block-header(${t})
    l-literal-content(n+1,${t})
  )`).join(' | ')}

[174] c-l+folded(n) ::=
  ${Object.values(ChompingBehavior).map(t => `(
    c-folded
    c-b-block-header(${t})
    l-folded-content(n+1,${t})
  )`).join(' | ')}
`);

const INTRODUCE_INDENTATION = {
  'l+block-sequence': {
    number: 183,
    parameters: ['n'],
    body: detectIndentation(n => n + 1, plus(sequence(
      ref('s-indent', { n: 'm' }),
      ref('c-l-block-seq-entry', { n: 'm' }),
    )))
  },

  's-l+block-indented': {
    number: 185,
    parameters: ['n'],
    body: first(
      detectIndentation(1, sequence(
        ref('s-indent', { n: 'm' }),
        first(
          ref('ns-l-compact-sequence', { n: ['n', 'm', 1] }),
          ref('ns-l-compact-mapping', { n: ['n', 'm', 1] }),
        ),
      )),
      ref('s-l+block-node', { n: 'n', c: 'c' }),
      sequence(
        ref('e-node'),
        ref('s-l-comments'),
      ),
    )
  },

  'l+block-mapping': {
    number: 187,
    parameters: ['n'],
    body: detectIndentation(n => n + 1, plus(sequence(
      ref('s-indent', { n: 'm' }),
      ref('ns-l-block-map-entry', { n: 'm' }),
    )))
  },
} as const satisfies Grammar;

const HANDLE_N_MINUS_1 = parseGrammar(String.raw`
[63]
s-indent(0) ::=
  <empty>

# When n≥0
s-indent(n) ::=
  s-space s-indent(n-1)

[64]
s-indent-less-than(1) ::=
  <empty>

# When n≥1
s-indent-less-than(n) ::=
  s-space s-indent-less-than(n-1)
  | <empty>

[65]
s-indent-less-or-equal(0) ::=
  <empty>

# When n≥0
s-indent-less-or-equal(n) ::=
  s-space s-indent-less-or-equal(n-1)
  | <empty>
`);

const UNBOUNDED_REPETITION_FIX = parseGrammar(String.raw`
[202] l-document-prefix ::= c-byte-order-mark | l-comment
`);

const FLOW_MAPPING_IMPLICIT_ENTRY_FIX = parseGrammar(String.raw`
[144] ns-flow-map-implicit-entry(n,c) ::=
    c-ns-flow-map-json-key-entry(n,c)
  | ns-flow-map-yaml-key-entry(n,c)
  | c-ns-flow-map-empty-key-entry(n,c)
`);

const BLOCK_SCALAR_INDICATORS_FIX = parseGrammar(String.raw`
[162] c-b-block-header(t) ::=
  (
      (
        c-indentation-indicator
        c-chomping-indicator(t)
      )
    | (
        c-chomping-indicator(t)
        c-indentation-indicator?
      )
  )
  s-b-comment
`);

const BLOCK_COLLECTION_NODE_PROPERTIES_FIX = parseGrammar(String.raw`
[200] s-l+block-collection(n,c) ::=
  (
    s-separate(n+1,c)
    block-collection-node-properties(n+1,c)
  )?
  s-l-comments
  (
      seq-space(n,c)
    | l+block-mapping(n)
  )

block-collection-node-properties(n,c) ::=
    (
      c-ns-tag-property
      (
        s-separate(n,c)
        c-ns-anchor-property
      [ lookahead = s-l-comments ]
      )?
      [ lookahead = s-l-comments ]
    )
  | (
      c-ns-anchor-property
      (
        s-separate(n,c)
        c-ns-tag-property
      [ lookahead = s-l-comments ]
      )?
      [ lookahead = s-l-comments ]
    )
`);

export const grammar = {
  ...GENERATED_BASE,

  ...FORBIDDEN_CONTENT,
  ...INTRODUCE_T,
  ...INTRODUCE_INDENTATION,
  ...HANDLE_N_MINUS_1,

  // ...FLOW_MAPPING_CONTEXT_FIX,
  ...UNBOUNDED_REPETITION_FIX,
  ...FLOW_MAPPING_IMPLICIT_ENTRY_FIX,
  ...BLOCK_SCALAR_INDICATORS_FIX,
  ...BLOCK_COLLECTION_NODE_PROPERTIES_FIX,
} satisfies Grammar;

export const rootProduction = 'l-yaml-stream';
