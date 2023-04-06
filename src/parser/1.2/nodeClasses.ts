export const nodeClasses = {
  document: ['l-any-document', 'l-explicit-document'],
  directive: ['ns-yaml-directive', 'ns-tag-directive', 'ns-reserved-directive'],

  nodeWithProperties: [
    'e-node',

    's-l+block-node',
    's-l+block-indented',

    'ns-flow-node',
    'c-flow-json-node',
    'ns-flow-yaml-node',

    'ns-flow-pair',
  ],
  tagProperty: ['c-ns-tag-property'],
  anchorProperty: ['c-ns-anchor-property'],

  blockScalarFoldingIndicator: ['c-literal', 'c-folded'],
  blockScalarIndentationIndicator: ['c-indentation-indicator'],
  blockScalarChompingIndicator: ['c-chomping-indicator'],
  blockScalarContent: ['l-literal-content', 'l-folded-content'],

  mappingEntry: ['ns-l-block-map-entry', 'ns-flow-map-entry', 'ns-flow-pair'],

  alias: ['c-ns-alias-node'],
  emptyScalar: ['e-node', 'e-scalar'],
  plainScalar: ['ns-plain'],
  singleQuotedScalar: ['c-single-quoted'],
  doubleQuotedScalar: ['c-double-quoted'],
  literalScalar: ['c-l+literal'],
  foldedScalar: ['c-l+folded'],

  mapping: ['l+block-mapping', 'c-flow-mapping', 'ns-l-compact-mapping', 'ns-flow-pair'],
  sequence: ['l+block-sequence', 'c-flow-sequence', 'ns-l-compact-sequence'],

  ignore: [
    'l-document-prefix',
    'l-document-suffix',

    'c-byte-order-mark',
    'c-directive',
    'c-directives-end',
    'c-collect-entry',
    'c-sequence-start',
    'c-sequence-end',
    'c-sequence-entry',
    'c-mapping-start',
    'c-mapping-end',
    'c-mapping-key',
    'c-mapping-value',

    's-l-comments',
    's-b-comment',
    's-indent',
    's-separate',
    's-separate-in-line',
    'l-comment',
  ],

  recurse: [

  ],
} as const;
