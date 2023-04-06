export const nodeClasses = {
  document: ['any-document', 'start-indicator-and-document'],
  directive: ['yaml-directive-line', 'tag-directive-line', 'reserved-directive-line'],

  nodeWithProperties: [
    'block-node',
    'block-indented-node',
    'empty-node',
    'flow-node',
    'flow-json-node',
    'flow-yaml-node',
    'flow-pair',
  ],
  tagProperty: ['tag-property'],
  anchorProperty: ['anchor-property'],

  blockScalarIndentationIndicator: ['block-scalar-indentation-indicator'],
  blockScalarChompingIndicator: ['block-scalar-chomping-indicator'],
  blockScalarContent: ['literal-scalar-content', 'folded-scalar-content'],

  mappingEntry: ['block-mapping-entry', 'flow-mapping-entry', 'flow-pair'],

  alias: ['alias-node'],
  emptyScalar: ['empty-node'],
  plainScalar: ['flow-plain-scalar'],
  singleQuotedScalar: ['single-quoted-scalar'],
  doubleQuotedScalar: ['double-quoted-scalar'],
  literalScalar: ['block-literal-scalar'],
  foldedScalar: ['block-folded-scalar'],

  mapping: ['block-mapping', 'compact-mapping', 'flow-mapping', 'flow-pair'],
  sequence: ['block-sequence', 'compact-sequence', 'flow-sequence'],

  ignore: [
    // 'l-document-prefix',
    // 'l-document-suffix',

    // 'c-byte-order-mark',
    // 'c-directive',
    // 'c-directives-end',
    // 'c-collect-entry',
    // 'c-sequence-start',
    // 'c-sequence-end',
    // 'c-sequence-entry',
    // 'c-mapping-start',
    // 'c-mapping-end',
    // 'c-mapping-key',
    // 'c-mapping-value',

    // 's-l-comments',
    // 's-b-comment',
    // 's-indent',
    // 's-separate',
    // 's-separate-in-line',
    // 'l-comment',
  ],
} as const;
