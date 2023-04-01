import {
  str,
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
[1]
yaml-stream ::=
  document-prefix*
  any-document?
  (
      (
        document-suffix+
        document-prefix*
        any-document?
      )
    | byte-order-mark
    | comment-line
    | start-indicator-and-document
  )*

[2]
document-prefix ::=
  byte-order-mark?
  blanks-and-comment-line*

[3]
document-suffix ::=
  document-end-indicator
  comment-lines

[4]
document-start-indicator ::=
  "---"

[5]
document-end-indicator ::=
  "..."                             # Not followed by non-ws char

[6]
any-document ::=
    directives-and-document
  | start-indicator-and-document
  | bare-document

[7]
directives-and-document ::=
  directive-line+
  start-indicator-and-document

[8]
start-indicator-and-document ::=
  document-start-indicator
  (
      bare-document
    | (
        empty-node
        comment-lines
      )
  )

[9]
bare-document ::=
  block-node(-1,BLOCK-IN)
  /* Excluding forbidden-content */

[10]
directive-line ::=
  '%'
  (
      yaml-directive-line
    | tag-directive-line
    | reserved-directive-line
  )
  comment-lines

[11]
forbidden-content ::=
  <start-of-line>
  (
      document-start-indicator
    | document-end-indicator
  )
  (
      line-ending
    | blank-character
  )

[12]
block-node(n,c) ::=
    block-node-in-a-block-node(n,c)
  | flow-node-in-a-block-node(n)

[13]
block-node-in-a-block-node(n,c) ::=
    block-scalar(n,c)
  | block-collection(n,c)

[14]
flow-node-in-a-block-node(n) ::=
  separation-characters(n+1,FLOW-OUT)
  flow-node(n+1,FLOW-OUT)
  comment-lines

[15]
block-collection(n,c) ::=
  (
    separation-characters(n+1,c)
    node-properties(n+1,c)
  )?
  comment-lines
  (
      block-sequence-context(n,c)
    | block-mapping(n)
  )

[16]
block-sequence-context(n,BLOCK-OUT) ::= block-sequence(n-1)
block-sequence-context(n,BLOCK-IN)  ::= block-sequence(n)

[17]
block-scalar(n,c) ::=
  separation-characters(n+1,c)
  (
    node-properties(n+1,c)
    separation-characters(n+1,c)
  )?
  (
      block-literal-scalar(n)
    | block-folded-scalar(n)
  )

[18]
block-mapping(n) ::=
  (
    indentation-spaces(n+1+m)
    block-mapping-entry(n+1+m)
  )+

[19]
block-mapping-entry(n) ::=
    block-mapping-explicit-entry(n)
  | block-mapping-implicit-entry(n)

[20]
block-mapping-explicit-entry(n) ::=
  block-mapping-explicit-key(n)
  (
      block-mapping-explicit-value(n)
    | empty-node
  )

[21]
block-mapping-explicit-key(n) ::=
  '?'                               # Not followed by non-ws char
  block-indented-node(n,BLOCK-OUT)

[22]
block-mapping-explicit-value(n) ::=
  indentation-spaces(n)
  ':'                               # Not followed by non-ws char
  block-indented-node(n,BLOCK-OUT)

[23]
block-mapping-implicit-entry(n) ::=
  (
      block-mapping-implicit-key
    | empty-node
  )
  block-mapping-implicit-value(n)

[24]
block-mapping-implicit-key ::=
    implicit-json-key(BLOCK-KEY)
  | implicit-yaml-key(BLOCK-KEY)

[25]
block-mapping-implicit-value(n) ::=
  ':'                               # Not followed by non-ws char
  (
      block-node(n,BLOCK-OUT)
    | (
        empty-node
        comment-lines
      )
  )

[26]
compact-mapping(n) ::=
  block-mapping-entry(n)
  (
    indentation-spaces(n)
    block-mapping-entry(n)
  )*

[27]
block-sequence(n) ::=
  (
    indentation-spaces(n+1+m)
    block-sequence-entry(n+1+m)
  )+

[28]
block-sequence-entry(n) ::=
  '-'
  [ lookahead ≠ non-space-character ]
  block-indented-node(n,BLOCK-IN)

[29]
block-indented-node(n,c) ::=
    (
      indentation-spaces(m)
      (
          compact-sequence(n+1+m)
        | compact-mapping(n+1+m)
      )
    )
  | block-node(n,c)
  | (
      empty-node
      comment-lines
    )

[30]
compact-sequence(n) ::=
  block-sequence-entry(n)
  (
    indentation-spaces(n)
    block-sequence-entry(n)
  )*

[31]
block-literal-scalar(n) ::=
  '|'
  block-scalar-indicators(t)
  literal-scalar-content(n+m,t)

[32]
literal-scalar-content(n,t) ::=
  (
    literal-scalar-line-content(n)
    literal-scalar-next-line(n)*
    block-scalar-chomp-last(t)
  )?
  block-scalar-chomp-empty(n,t)

[33]
literal-scalar-line-content(n) ::=
  empty-line(n,BLOCK-IN)*
  indentation-spaces(n)
  non-break-character+

[34]
literal-scalar-next-line(n) ::=
  break-as-line-feed
  literal-scalar-line-content(n)

[35]
block-folded-scalar(n) ::=
  '>'
  block-scalar-indicators(t)
  folded-scalar-content(n+m,t)

[36]
folded-scalar-content(n,t) ::=
  (
    folded-scalar-lines-different-indentation(n)
    block-scalar-chomp-last(t)
  )?
  block-scalar-chomp-empty(n,t)

[37]
folded-scalar-lines-different-indentation(n) ::=
  folded-scalar-lines-same-indentation(n)
  (
    break-as-line-feed
    folded-scalar-lines-same-indentation(n)
  )*

[38]
folded-scalar-lines-same-indentation(n) ::=
  empty-line(n,BLOCK-IN)*
  (
      folded-scalar-lines(n)
    | folded-scalar-spaced-lines(n)
  )

[39]
folded-scalar-lines(n) ::=
  folded-scalar-text(n)
  (
    folded-whitespace(n,BLOCK-IN)
    folded-scalar-text(n)
  )*

[40]
folded-scalar-spaced-lines(n) ::=
  folded-scalar-spaced-text(n)
  (
    line-break-and-empty-lines(n)
    folded-scalar-spaced-text(n)
  )*

[41]
folded-scalar-text(n) ::=
  indentation-spaces(n)
  non-space-character
  non-break-character*

[42]
line-break-and-empty-lines(n) ::=
  break-as-line-feed
  empty-line(n,BLOCK-IN)*

[43]
folded-scalar-spaced-text(n) ::=
  indentation-spaces(n)
  blank-character
  non-break-character*

[44]
block-scalar-indicators(t) ::=
  (
      (
        block-scalar-indentation-indicator
        block-scalar-chomping-indicator(t)
      )
    | (
        block-scalar-chomping-indicator(t)
        block-scalar-indentation-indicator
      )
  )
  comment-line

[45]
block-scalar-indentation-indicator ::=
  decimal-digit-1-9

[46]
block-scalar-chomping-indicator(STRIP) ::= '-'
block-scalar-chomping-indicator(KEEP)  ::= '+'
block-scalar-chomping-indicator(CLIP)  ::= ""

[47]
block-scalar-chomp-last(STRIP) ::= line-break | <end-of-input>
block-scalar-chomp-last(CLIP)  ::= break-as-line-feed | <end-of-input>
block-scalar-chomp-last(KEEP)  ::= break-as-line-feed | <end-of-input>

[48]
block-scalar-chomp-empty(n,STRIP) ::= line-strip-empty(n)
block-scalar-chomp-empty(n,CLIP)  ::= line-strip-empty(n)
block-scalar-chomp-empty(n,KEEP)  ::= line-keep-empty(n)

[49]
line-strip-empty(n) ::=
  (
    indentation-spaces-less-or-equal(n)
    line-break
  )*
  line-trail-comments(n)?

[50]
line-keep-empty(n) ::=
  empty-line(n,BLOCK-IN)*
  line-trail-comments(n)?

[51]
line-trail-comments(n) ::=
  indentation-spaces-less-than(n)
  comment-content
  line-ending
  comment-line*

[52]
flow-node(n,c) ::=
    alias-node
  | flow-content(n,c)
  | (
      node-properties(n,c)
      (
        (
          separation-characters(n,c)
          flow-content(n,c)
        )
        | empty-node
      )
    )

[53]
flow-content(n,c) ::=
    flow-yaml-content(n,c)
  | flow-json-content(n,c)

[54]
flow-yaml-content(n,c) ::=
  flow-plain-scalar(n,c)

[55]
flow-json-content(n,c) ::=
    flow-sequence(n,c)
  | flow-mapping(n,c)
  | single-quoted-scalar(n,c)
  | double-quoted-scalar(n,c)

[56]
flow-mapping(n,c) ::=
  '{'
  separation-characters(n,c)?
  flow-mapping-context(n,c)?
  '}'

[57]
flow-mapping-entries(n,c) ::=
  flow-mapping-entry(n,c)
  separation-characters(n,c)?
  (
    ','
    separation-characters(n,c)?
    flow-mapping-entries(n,c)?
  )?

[58]
flow-mapping-entry(n,c) ::=
    (
      '?'                           # Not followed by non-ws char
      separation-characters(n,c)
      flow-mapping-explicit-entry(n,c)
    )
  | flow-mapping-implicit-entry(n,c)

[59]
flow-mapping-explicit-entry(n,c) ::=
    flow-mapping-implicit-entry(n,c)
  | (
      empty-node
      empty-node
    )

[60]
flow-mapping-implicit-entry(n,c) ::=
    flow-mapping-yaml-key-entry(n,c)
  | flow-mapping-empty-key-entry(n,c)
  | flow-mapping-json-key-entry(n,c)

[61]
flow-mapping-yaml-key-entry(n,c) ::=
  flow-yaml-node(n,c)
  (
      (
        separation-characters(n,c)?
        flow-mapping-separate-value(n,c)
      )
    | empty-node
  )

[62]
flow-mapping-empty-key-entry(n,c) ::=
  empty-node
  flow-mapping-separate-value(n,c)

[63]
flow-mapping-separate-value(n,c) ::=
  ':'
  [ lookahead ≠ non-space-plain-scalar-character(c) ]
  (
      (
        separation-characters(n,c)
        flow-node(n,c)
      )
    | empty-node
  )

[64]
flow-mapping-json-key-entry(n,c) ::=
  flow-json-node(n,c)
  (
      (
        separation-characters(n,c)?
        flow-mapping-adjacent-value(n,c)
      )
    | empty-node
  )

[65]
flow-mapping-adjacent-value(n,c) ::=
  ':'
  (
      (
        separation-characters(n,c)?
        flow-node(n,c)
      )
    | empty-node
  )

[66]
flow-pair(n,c) ::=
    (
      '?'                           # Not followed by non-ws char
      separation-characters(n,c)
      flow-mapping-explicit-entry(n,c)
    )
  | flow-pair-entry(n,c)

[67]
flow-pair-entry(n,c) ::=
    flow-pair-yaml-key-entry(n,c)
  | flow-mapping-empty-key-entry(n,c)
  | flow-pair-json-key-entry(n,c)

[68]
flow-pair-yaml-key-entry(n,c) ::=
  implicit-yaml-key(FLOW-KEY)
  flow-mapping-separate-value(n,c)

[69]
flow-pair-json-key-entry(n,c) ::=
  implicit-json-key(FLOW-KEY)
  flow-mapping-adjacent-value(n,c)

[70]
implicit-yaml-key(c) ::=
  flow-yaml-node(0,c)
  separation-blanks?
  /* At most 1024 characters altogether */

[71]
implicit-json-key(c) ::=
  flow-json-node(0,c)
  separation-blanks?
  /* At most 1024 characters altogether */

[72]
flow-yaml-node(n,c) ::=
    alias-node
  | flow-yaml-content(n,c)
  | (
      node-properties(n,c)
      (
          (
            separation-characters(n,c)
            flow-yaml-content(n,c)
          )
        | empty-node
      )
    )

[73]
flow-json-node(n,c) ::=
  (
    node-properties(n,c)
    separation-characters(n,c)
  )?
  flow-json-content(n,c)

[74]
flow-sequence(n,c) ::=
  '['
  separation-characters(n,c)?
  flow-sequence-context(n,c)?
  ']'

[75]
flow-sequence-entries(n,c) ::=
  flow-sequence-entry(n,c)
  separation-characters(n,c)?
  (
    ','
    separation-characters(n,c)?
    flow-sequence-entries(n,c)?
  )?

[76]
flow-sequence-entry(n,c) ::=
    flow-pair(n,c)
  | flow-node(n,c)

[77]
double-quoted-scalar(n,c) ::=
  '"'
  double-quoted-text(n,c)
  '"'

[78]
double-quoted-text(n,BLOCK-KEY) ::= double-quoted-one-line
double-quoted-text(n,FLOW-KEY)  ::= double-quoted-one-line
double-quoted-text(n,FLOW-OUT)  ::= double-quoted-multi-line(n)
double-quoted-text(n,FLOW-IN)   ::= double-quoted-multi-line(n)

[79]
double-quoted-multi-line(n) ::=
  double-quoted-first-line
  (
      double-quoted-next-line(n)
    | blank-character*
  )

[80]
double-quoted-one-line ::=
  non-break-double-quoted-character*

[81]
double-quoted-first-line ::=
  (
    blank-character*
    non-space-double-quoted-character
  )*

[82]
double-quoted-next-line(n) ::=
  (
      double-quoted-line-continuation(n)
    | flow-folded-whitespace(n)
  )
  (
    non-space-double-quoted-character
    double-quoted-first-line
    (
        double-quoted-next-line(n)
      | blank-character*
    )
  )?

[83]
non-space-double-quoted-character ::=
    non-break-double-quoted-character
  - blank-character

[84]
non-break-double-quoted-character ::=
    double-quoted-scalar-escape-character
  | (
        json-character
      - '\'
      - '"'
    )

[85]
double-quoted-line-continuation(n) ::=
  blank-character*
  '\'
  line-break
  empty-line(n,FLOW-IN)*
  indentation-spaces-plus-maybe-more(n)

[86]
flow-mapping-context(n,FLOW-OUT)  ::= flow-sequence-entries(n,FLOW-IN)
flow-mapping-context(n,FLOW-IN)   ::= flow-sequence-entries(n,FLOW-IN)
flow-mapping-context(n,BLOCK-KEY) ::= flow-sequence-entries(n,FLOW-KEY)
flow-mapping-context(n,FLOW-KEY)  ::= flow-sequence-entries(n,FLOW-KEY)

[87]
flow-sequence-context(n,FLOW-OUT)  ::= flow-sequence-entries(n,FLOW-IN)
flow-sequence-context(n,FLOW-IN)   ::= flow-sequence-entries(n,FLOW-IN)
flow-sequence-context(n,BLOCK-KEY) ::= flow-sequence-entries(n,FLOW-KEY)
flow-sequence-context(n,FLOW-KEY)  ::= flow-sequence-entries(n,FLOW-KEY)

[88]
single-quoted-scalar(n,c) ::=
  "'"
  single-quoted-text(n,c)
  "'"

[89]
single-quoted-text(BLOCK-KEY) ::= single-quoted-one-line
single-quoted-text(FLOW-KEY)  ::= single-quoted-one-line
single-quoted-text(FLOW-OUT)  ::= single-quoted-multi-line(n)
single-quoted-text(FLOW-IN)   ::= single-quoted-multi-line(n)

[90]
single-quoted-multi-line(n) ::=
  single-quoted-first-line
  (
      single-quoted-next-line(n)
    | blank-character*
  )

[91]
single-quoted-one-line ::=
  non-break-single-quoted-character*

[92]
single-quoted-first-line ::=
  (
    blank-character*
    non-space-single-quoted-character
  )*

[93]
single-quoted-next-line(n) ::=
  flow-folded-whitespace(n)
  (
    non-space-single-quoted-character
    single-quoted-first-line
    (
        single-quoted-next-line(n)
      | blank-character*
    )
  )?

[94]
non-space-single-quoted-character ::=
    non-break-single-quoted-character
  - blank-character

[95]
non-break-single-quoted-character ::=
    single-quoted-escaped-single-quote
  | (
        json-character
      - "'"
    )

[96]
single-quoted-escaped-single-quote ::=
  "''"

[97]
flow-plain-scalar(n,FLOW-OUT)  ::= plain-scalar-multi-line(n,FLOW-OUT)
flow-plain-scalar(n,FLOW-IN)   ::= plain-scalar-multi-line(n,FLOW-IN)
flow-plain-scalar(n,BLOCK-KEY) ::= plain-scalar-single-line(BLOCK-KEY)
flow-plain-scalar(n,FLOW-KEY)  ::= plain-scalar-single-line(FLOW-KEY)

[98]
plain-scalar-multi-line(n,c) ::=
  plain-scalar-single-line(c)
  plain-scalar-next-line(n,c)*

[99]
plain-scalar-single-line(c) ::=
  plain-scalar-first-character(c)
  plain-scalar-line-characters(c)

[100]
plain-scalar-next-line(n,c) ::=
  flow-folded-whitespace(n)
  plain-scalar-characters(c)
  plain-scalar-line-characters(c)

[101]
plain-scalar-line-characters(c) ::=
  (
    blank-character*
    plain-scalar-characters(c)
  )*

[102]
plain-scalar-first-character(c) ::=
    (
        non-space-character
      - '?'                         # Mapping key
      - ':'                         # Mapping value
      - '-'                         # Sequence entry
      - '{'                         # Mapping start
      - '}'                         # Mapping end
      - '['                         # Sequence start
      - ']'                         # Sequence end
      - ','                         # Entry separator
      - '#'                         # Comment
      - '&'                         # Anchor
      - '*'                         # Alias
      - '!'                         # Tag
      - '|'                         # Literal scalar
      - '>'                         # Folded scalar
      - "'"                         # Single quote
      - '"'                         # Double quote
      - '%'                         # Directive
      - '@'                         # Reserved
      - '${'`'}'                         # Reserved
    )
  | (
      ( '?' | ':' | '-' )
      [ lookahead = non-space-plain-scalar-character(c) ]
    )

[103]
plain-scalar-characters(c) ::=
    (
        non-space-plain-scalar-character(c)
      - ':'
      - '#'
    )
  | (
      [ lookbehind = non-space-character ]
      '#'
    )
  | (
      ':'
      [ lookahead = non-space-plain-scalar-character(c) ]
    )

[104]
non-space-plain-scalar-character(FLOW-OUT)  ::= block-plain-scalar-character
non-space-plain-scalar-character(FLOW-IN)   ::= flow-plain-scalar-character
non-space-plain-scalar-character(BLOCK-KEY) ::= block-plain-scalar-character
non-space-plain-scalar-character(FLOW-KEY)  ::= flow-plain-scalar-character

[105]
block-plain-scalar-character ::=
  non-space-character

[106]
flow-plain-scalar-character ::=
    non-space-character
  - flow-collection-indicators

[107]
alias-node ::=
  '*'
  anchor-name

[108]
empty-node ::=
  ""

[109]
indentation-spaces(0) ::=
  ""

# When n≥0
indentation-spaces(n+1) ::=
  space-character
  indentation-spaces(n)

[110]
indentation-spaces-less-than(1) ::=
  ""

# When n≥1
indentation-spaces-less-than(n+1) ::=
    (
      space-character
      indentation-spaces-less-than(n)
    )
  | ""

[111]
indentation-spaces-less-or-equal(0) ::=
  ""

# When n≥0
indentation-spaces-less-or-equal(n+1) ::=
    (
      space-character
      indentation-spaces-less-or-equal(n)
    )
  | ""

[112]
line-prefix-spaces(n,BLOCK-OUT) ::= indentation-spaces-exact(n)
line-prefix-spaces(n,BLOCK-IN)  ::= indentation-spaces-exact(n)
line-prefix-spaces(n,FLOW-OUT)  ::= indentation-spaces-plus-maybe-more(n)
line-prefix-spaces(n,FLOW-IN)   ::= indentation-spaces-plus-maybe-more(n)

[113]
indentation-spaces-exact(n) ::=
  indentation-spaces(n)

[114]
indentation-spaces-plus-maybe-more(n) ::=
  indentation-spaces(n)
  separation-blanks?

[115]
flow-folded-whitespace(n) ::=
  separation-blanks?
  folded-whitespace(n,FLOW-IN)
  indentation-spaces-plus-maybe-more(n)

[116]
folded-whitespace(n,c) ::=
    (
      line-break
      empty-line(n,c)+
    )
  | break-as-space

[117]
comment-lines ::=
  (
    comment-line
  | <start-of-line>
  )
  blanks-and-comment-line*

[118]
comment-line ::=
  (
    separation-blanks
    comment-content?
  )?
  line-ending

[119]
blanks-and-comment-line ::=
  separation-blanks
  comment-content?
  line-ending

[120]
comment-content ::=
  '#'
  non-break-character*

[121]
empty-line(n,c) ::=
  (
      line-prefix-spaces(n,c)
    | indentation-spaces-less-than(n)
  )
  break-as-line-feed

[122]
separation-characters(n,BLOCK-OUT) ::= separation-lines(n)
separation-characters(n,BLOCK-IN)  ::= separation-lines(n)
separation-characters(n,FLOW-OUT)  ::= separation-lines(n)
separation-characters(n,FLOW-IN)   ::= separation-lines(n)
separation-characters(n,BLOCK-KEY) ::= separation-blanks
separation-characters(n,FLOW-KEY)  ::= separation-blanks

[123]
separation-lines(n) ::=
    (
      comment-lines
      indentation-spaces-plus-maybe-more(n)
    )
  | separation-blanks

[124]
separation-blanks ::=
    blank-character+
  | <start-of-line>

[125]
yaml-directive-line ::=
  "YAML"
  separation-blanks
  yaml-version-number

[126]
yaml-version-number ::=
  decimal-digit+
  '.'
  decimal-digit+

[127]
reserved-directive-line ::=
  directive-name
  (
    separation-blanks
    directive-parameter
  )*

[128]
directive-name ::=
  non-space-character+

[129]
directive-parameter ::=
  non-space-character+

[130]
tag-directive-line ::=
  "TAG"
  separation-blanks
  tag-handle
  separation-blanks
  tag-prefix

[131]
tag-handle ::=
    named-tag-handle
  | secondary-tag-handle
  | primary-tag-handle

[132]
named-tag-handle ::=
  '!'
  word-character+
  '!'

[133]
secondary-tag-handle ::=
  "!!"

[134]
primary-tag-handle ::=
  '!'

[135]
tag-prefix ::=
    local-tag-prefix
  | global-tag-prefix

[136]
local-tag-prefix ::=
  '!'
  uri-character*

[137]
global-tag-prefix ::=
  tag-character
  uri-character*

[138]
node-properties(n,c) ::=
    (
      anchor-property
      (
        separation-characters(n,c)
        tag-property
      )?
    )
  | (
      tag-property
      (
        separation-characters(n,c)
        anchor-property
      )?
    )

[139]
anchor-property ::=
  '&'
  anchor-name

[140]
anchor-name ::=
  anchor-character+

[141]
anchor-character ::=
    non-space-character
  - flow-collection-indicators

[142]
tag-property ::=
    verbatim-tag
  | shorthand-tag
  | non-specific-tag

[143]
verbatim-tag ::=
  "!<"
  uri-character+
  '>'

[144]
shorthand-tag ::=
  tag-handle
  tag-character+

[145]
non-specific-tag ::=
  '!'

[146]
byte-order-mark ::=
  xFEFF

[147]
yaml-character ::=
                                    # 8 bit
    x09                             # Tab
  | x0A                             # Line feed
  | x0D                             # Carriage return
  | [x20-x7E]                       # Printable ASCII
                                    # 16 bit
  | x85                             # Next line (NEL)
  | [xA0-xD7FF]                     # Basic multilingual plane (BMP)
  | [xE000-xFFFD]                   # Additional unicode areas
  | [x010000-x10FFFF]               # 32 bit

[148]
json-character ::=
    x09                             # Tab
  | [x20-x10FFFF]                   # Non-C0-control characters

[149]
non-space-character ::=
    non-break-character
  - blank-character

[150]
non-break-character ::=
    yaml-character
  - x0A
  - x0D
  - byte-order-mark

[151]
blank-character ::=
    x20                             # Space
  | x09                             # Tab

[152]
space-character ::=
  x20

[153]
line-ending ::=
    line-break
  | <end-of-input>

[154]
break-as-space ::=
  line-break

[155]
break-as-line-feed ::=
  line-break

[156]
line-break ::=
    (
      x0D                           # Carriage return
      x0A                           # Line feed
    )
  | x0D
  | x0A

[157]
flow-collection-indicators ::=
    ','                             # Flow collection separator
  | '{'                             # Flow mapping start
  | '}'                             # Flow mapping end
  | '['                             # Flow sequence start
  | ']'                             # Flow sequence end

[158]
double-quoted-scalar-escape-character ::=
  '\'
  (
      '0'
    | 'a'
    | 'b'
    | 't' | x09
    | 'n'
    | 'v'
    | 'f'
    | 'r'
    | 'e'
    | x20
    | '"'
    | '/'
    | '\'
    | 'N'
    | '_'
    | 'L'
    | 'P'
    | ( 'x' hexadecimal-digit{2} )
    | ( 'u' hexadecimal-digit{4} )
    | ( 'U' hexadecimal-digit{8} )
  )

[159]
tag-character ::=
    uri-character
  - '!'
  - flow-collection-indicators

[160]
uri-character ::=
    (
      '%'
      hexadecimal-digit{2}
    )
  | word-character
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

[161]
word-character ::=
    decimal-digit
  | ascii-alpha-character
  | '-'

[162]
hexadecimal-digit ::=
    decimal-digit
  | [x41-x46]                       # A-F
  | [x61-x66]                       # a-f

[163]
decimal-digit ::=
  [x30-x39]                         # 0-9

[164]
decimal-digit-1-9 ::=
  [x31-x39]                         # 1-9

[165]
ascii-alpha-character ::=
    [x41-x5A]                       # A-Z
  | [x61-x7A]                       # a-z

`);

const FORBIDDEN_CONTENT = parseGrammar(String.raw`
[33]
literal-scalar-line-content(n) ::=
  empty-line(n,BLOCK-IN)*
  [ lookahead ≠ forbidden-content ]
  indentation-spaces(n)
  non-break-character+

[41]
folded-scalar-text(n) ::=
  [ lookahead ≠ forbidden-content ]
  indentation-spaces(n)
  non-space-character
  non-break-character*

[99]
plain-scalar-single-line(c) ::=
  [ lookahead ≠ forbidden-content ]
  plain-scalar-first-character(c)
  plain-scalar-line-characters(c)

[100]
plain-scalar-next-line(n,c) ::=
  flow-folded-whitespace(n)
  [ lookahead ≠ forbidden-content ]
  plain-scalar-characters(c)
  plain-scalar-line-characters(c)
`);

const INTRODUCE_T = {
  /* 31 */ 'block-literal-scalar': first(
    ...Object.values(ChompingBehavior).map(t => sequence(
      str('|'),
      ref('block-scalar-indicators', { t }),
      ref('literal-scalar-content', { n: ['n', 1], t }),
    ))
  ),

  /* 35 */ 'block-folded-scalar': first(
    ...Object.values(ChompingBehavior).map(t => sequence(
      str('>'),
      ref('block-scalar-indicators', { t }),
      ref('folded-scalar-content', { n: ['n', 1], t }),
    ))
  ),
};

const INTRODUCE_INDENTATION = {
  /* 18 */ 'block-mapping':
    detectIndentation(n => n + 1, plus(sequence(
      ref('indentation-spaces', { n: 'm' }),
      ref('block-mapping-entry', { n: 'm' }),
    ))),

  /* 27 */ 'block-sequence':
    detectIndentation(n => n + 1, plus(sequence(
      ref('indentation-spaces', { n: 'm' }),
      ref('block-sequence-entry', { n: 'm' }),
    ))),

  /* 29 */ 'block-indented-node': first(
    detectIndentation(1, sequence(
      ref('indentation-spaces', { n: 'm' }),
      first(
        ref('compact-sequence', { n: ['n', 'm', 1] }),
        ref('compact-mapping', { n: ['n', 'm', 1] }),
      ),
    )),
    ref('block-node', 'n', 'c'),
    sequence(
      'empty-node',
      'comment-lines',
    ),
  ),
} as const satisfies Grammar;

const HANDLE_N_MINUS_1 = parseGrammar(String.raw`
[109]
indentation-spaces(0) ::=
  ""

# When n≥0
indentation-spaces(n) ::=
  space-character
  indentation-spaces(n-1)

[110]
indentation-spaces-less-than(1) ::=
  ""

# When n≥1
indentation-spaces-less-than(n) ::=
    (
      space-character
      indentation-spaces-less-than(n-1)
    )
  | ""

[111]
indentation-spaces-less-or-equal(0) ::=
  ""

# When n≥0
indentation-spaces-less-or-equal(n) ::=
    (
      space-character
      indentation-spaces-less-or-equal(n-1)
    )
  | ""
`);

const FLOW_MAPPING_CONTEXT_FIX = parseGrammar(String.raw`
[86]
flow-mapping-context(n,FLOW-OUT)  ::= flow-mapping-entries(n,FLOW-IN)
flow-mapping-context(n,FLOW-IN)   ::= flow-mapping-entries(n,FLOW-IN)
flow-mapping-context(n,BLOCK-KEY) ::= flow-mapping-entries(n,FLOW-KEY)
flow-mapping-context(n,FLOW-KEY)  ::= flow-mapping-entries(n,FLOW-KEY)
`);

const UNBOUNDED_REPETITION_FIX = parseGrammar(String.raw`
[2]
document-prefix ::= byte-order-mark | blanks-and-comment-line
`);

const FLOW_MAPPING_IMPLICIT_ENTRY_FIX = parseGrammar(String.raw`
[60]
flow-mapping-implicit-entry(n,c) ::=
    flow-mapping-json-key-entry(n,c)
  | flow-mapping-yaml-key-entry(n,c)
  | flow-mapping-empty-key-entry(n,c)
`);

const BLOCK_SCALAR_INDICATORS_FIX = parseGrammar(String.raw`
[44]
block-scalar-indicators(t) ::=
  (
      (
        block-scalar-indentation-indicator
        block-scalar-chomping-indicator(t)
      )
    | (
        block-scalar-chomping-indicator(t)
        block-scalar-indentation-indicator?
      )
  )
  comment-line
`);

const BLOCK_COLLECTION_NODE_PROPERTIES_FIX = parseGrammar(String.raw`
[15]
block-collection(n,c) ::=
  (
    separation-characters(n+1,c)
    block-collection-node-properties(n+1,c)
  )?
  comment-lines
  (
      block-sequence-context(n,c)
    | block-mapping(n)
  )

block-collection-node-properties(n,c) ::=
    (
      anchor-property
      (
        separation-characters(n,c)
        tag-property
        [ lookahead = comment-line ]
      )?
      [ lookahead = comment-line ]
    )
  | (
      tag-property
      (
        separation-characters(n,c)
        anchor-property
        [ lookahead = comment-line ]
      )?
      [ lookahead = comment-line ]
    )
`);

// const NO_LOOKBEHIND: Grammar = {
//   /* 100 */ 'plain-scalar-next-line': sequence(
//     ref('flow-folded-whitespace', 'n'),
//     negativeLookahead('forbidden-content'), // TODO
//     negativeLookahead(str('#')),
//     ref('plain-scalar-characters', 'c'),
//     ref('plain-scalar-line-characters', 'c'),
//   ),

//   /* 101 */ 'plain-scalar-line-characters':
//     star(sequence(
//       star('blank-character'),
//       negativeLookahead(str('#')),
//       plus(ref('plain-scalar-characters', 'c')),
//     )),

//   /* 103 */ 'plain-scalar-characters': first(
//     sequence(
//       negativeLookahead(charSet(':')),
//       ref('non-space-plain-scalar-character', 'c'),
//     ),
//     sequence(
//       str(':'),
//       lookahead(ref('non-space-plain-scalar-character', 'c'))
//     ),
//   ),
// };

// const ANNOTATION_INDICATORS = new CharSet('(', ')');

// const ANNOTATIONS = {
//   'block-collection-node-properties': sequence(
//     first(ref('annotation-property', 'n', 'c'), 'anchor-property', 'tag-property'),
//     first(
//       sequence(
//         ref('separation-characters', 'n', 'c'),
//         ref('block-collection-node-properties', 'n', 'c'),
//       ),
//       lookahead('comment-line'),
//     ),
//   ),

//   /* 87 */ 'flow-sequence-context': context('c', {
//     'FLOW-OUT': ref('flow-sequence-entries', 'n', { c: 'FLOW-IN' }),
//     'FLOW-IN' : ref('flow-sequence-entries', 'n', { c: 'FLOW-IN' }),
//     'BLOCK-KEY': ref('flow-sequence-entries', 'n', { c: 'FLOW-KEY' }),
//     'FLOW-KEY' : ref('flow-sequence-entries', 'n', { c: 'FLOW-KEY' }),
//     'ANNOTATION-IN' : ref('flow-sequence-entries', 'n', { c: 'ANNOTATION-IN' }),
//   }),

//   /* 97 */ 'flow-plain-scalar': context('c', {
//     'FLOW-OUT': ref('plain-scalar-multi-line', 'n', { c: 'FLOW-OUT' }),
//     'FLOW-IN': ref('plain-scalar-multi-line', 'n', { c: 'FLOW-IN' }),
//     'BLOCK-KEY': ref('plain-scalar-single-line', { c: 'BLOCK-KEY' }),
//     'FLOW-KEY': ref('plain-scalar-single-line', { c: 'FLOW-KEY' }),
//     'ANNOTATION-IN': ref('plain-scalar-multi-line', 'n', { c: 'ANNOTATION-IN' }),
//   }),

//   /* 104 */ 'non-space-plain-scalar-character': context('c', {
//     'FLOW-OUT': 'block-plain-scalar-character',
//     'FLOW-IN': 'flow-plain-scalar-character',
//     'BLOCK-KEY': 'block-plain-scalar-character',
//     'FLOW-KEY': 'flow-plain-scalar-character',
//     'ANNOTATION-IN': 'annotation-plain-scalar-character',
//   }),

//   /* 122 */ 'separation-characters': context('c', {
//     'BLOCK-OUT': ref('separation-lines', 'n'),
//     'BLOCK-IN': ref('separation-lines', 'n'),
//     'FLOW-OUT': ref('separation-lines', 'n'),
//     'FLOW-IN': ref('separation-lines', 'n'),
//     'ANNOTATION-IN': ref('separation-lines', 'n'),
//     'BLOCK-KEY': 'separation-blanks',
//     'FLOW-KEY': 'separation-blanks',
//   }),

//   'annotation-plain-scalar-character': NON_SPACE_CHARACTER
//     .minus(FLOW_COLLECTION_INDICATORS)
//     .minus(ANNOTATION_INDICATORS),

//   'node-properties': sequence(
//     first(ref('annotation-property', 'n', 'c'), 'anchor-property', 'tag-property'),
//     optional(sequence(
//       ref('separation-characters', 'n', 'c'),
//       ref('node-properties', 'n', 'c'),
//     )),
//   ),

//   'annotation-property': sequence(
//     str('@'),
//     'annotation-name',
//     optional(ref('annotation-arguments', 'n', 'c')),
//   ),

//   'annotation-name': plus(ANCHOR_CHARACTER.minus(new CharSet('(', ')'))),

//   'annotation-arguments': sequence(
//     str('('),
//     optional('separation-characters'),
//     optional(ref('flow-sequence-context', 'n', { c: 'ANNOTATION-IN' })),
//     str(')'),
//   ),
// } as const satisfies Grammar;

export const GRAMMAR = {
  ...GENERATED_BASE,

  ...FORBIDDEN_CONTENT,
  ...INTRODUCE_T,
  ...INTRODUCE_INDENTATION,
  ...HANDLE_N_MINUS_1,

  ...FLOW_MAPPING_CONTEXT_FIX,
  ...UNBOUNDED_REPETITION_FIX,
  ...FLOW_MAPPING_IMPLICIT_ENTRY_FIX,
  ...BLOCK_SCALAR_INDICATORS_FIX,
  ...BLOCK_COLLECTION_NODE_PROPERTIES_FIX,
  // ...NO_LOOKBEHIND,
  // ...ANNOTATIONS,
};
