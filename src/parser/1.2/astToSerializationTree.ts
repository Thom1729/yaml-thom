import { AstNode, ChompingBehavior } from '../core/ast';

import {
  SerializationScalar,
  SerializationSequence,
  SerializationMapping,
  NonSpecificTag,
  type SerializationNode,
  Alias,
} from '@/nodes';

import {
  single,
  assertKeyOf,
  parseDecimal,
  Y,
  strictValues,
  strictEntries,
  strictFromEntries,
} from '@/util';

import {
  handlePlainScalarContent,
  handleSingleQuotedScalarContent,
  handleDoubleQuotedScalarContent,
  handleBlockScalarContent,
} from '../core/scalarContent';

import { iterateAst, groupNodes } from '../core/transformAst';

export function *astToSerializationTree(text: string, node: AstNode) {
  for (const { directives, body } of splitStream(node)) {
    const tagHandles = handleDirectives(directives.map(node => text.slice(...node.range)));

    yield buildDocument(text, body, tagHandles);
  }
}

const NODE_INFO = {
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

  document: ['l-any-document', 'l-explicit-document'],
  directive: ['ns-yaml-directive', 'ns-tag-directive', 'ns-reserved-directive'],

  nodeWithProperties: [
    'e-node',

    's-l+block-node',
    's-l+block-indented',

    'ns-flow-node',
    'c-flow-json-node',
    'ns-flow-yaml-node',
  ],
  tagProperty: ['c-ns-tag-property'],
  anchorProperty: ['c-ns-anchor-property'],

  blockScalarFoldingIndicator: ['c-literal', 'c-folded'],
  blockScalarIndentationIndicator: ['c-indentation-indicator'],
  blockScalarChompingIndicator: ['c-chomping-indicator'],
  blockScalarContent: ['l-literal-content', 'l-folded-content'],

  sequenceEntry: ['ns-flow-pair', 'ns-flow-node', 's-l+block-indented'],
  mappingEntry: ['ns-l-block-map-entry', 'ns-flow-map-entry', 'ns-flow-pair'],
} as const;

const CONTENT_NODE_CLASSES = {
  alias: ['c-ns-alias-node'],
  emptyScalar: ['e-node', 'e-scalar'],
  plainScalar: ['ns-plain'],
  singleQuotedScalar: ['c-single-quoted'],
  doubleQuotedScalar: ['c-double-quoted'],
  blockScalar: ['c-l+literal', 'c-l+folded'],

  mapping: ['l+block-mapping', 'c-flow-mapping', 'ns-l-compact-mapping', 'ns-flow-pair'],
  sequence: ['l+block-sequence', 'c-flow-sequence', 'ns-l-compact-sequence'],
};

const CONTENT_NODE_TO_CLASS = strictFromEntries(
  strictEntries(CONTENT_NODE_CLASSES)
    .flatMap(([className, nodeNames]) => nodeNames.map(nodeName => [nodeName, className]))
);

function *splitStream(node: AstNode) {
  const nodeStream = iterateAst(node.content, {
    return: NODE_INFO.document,
    ignore: NODE_INFO.ignore,
  });

  for (const node of nodeStream) {
    const {
      directives,
      body,
    } = groupNodes(node.content, {
      return: {
        'directives*': NODE_INFO.directive,
        body: NODE_INFO.nodeWithProperties,
      },
      recurse: [
        'l-directive-document',
        'l-explicit-document',
        'l-bare-document',
        'l-directive',
      ],
      ignore: NODE_INFO.ignore,
    });

    yield { directives, body };
  }
}

const YAML_VERSION_EXPR = /^(\d+)\.(\d+)$/;
const TAG_HANDLE_EXPR = /^!([-A-Za-z0-9]*!)?$/;
const TAG_PREFIX_EXPR = /^(?:[-A-Za-z0-9#;/?:@&=+$_.!~*'()]|%\p{Hex_Digit}{2})(?:[-A-Za-z0-9#;/?:@&=+$,_.!~*'()[\]]|%\p{Hex_Digit}{2})*$/u;

function handleDirectives(directives: readonly string[]) {
  let hasYamlDirective = false;
  const tagHandles = new Map<string, string>();

  for (const directiveText of directives) {
    const [name, ...args] = directiveText.split(/[ \t]+/g);

    if (name === 'YAML') {
      if (hasYamlDirective) {
        throw new Error(`Multiple %YAML directives`);
      } else {
        hasYamlDirective = true;
      }
      if (args.length !== 1) throw new Error(`Expect one arg for %YAML directive`);
      const versionString = args[0];

      const versionMatch = YAML_VERSION_EXPR.exec(versionString);
      if (versionMatch === null) throw new Error(`Invalid YAML version ${versionString}`);

      const major = parseDecimal(versionMatch[1]);
      const minor = parseDecimal(versionMatch[2]);

      if (major !== 1) {
        throw new Error(`Can't handle version ${versionString}`);
      } else if (minor === 1) { // %YAML 1.1
        // TODO: treat next line (x85), line separator (x2028) and paragraph separator (x2029) as line breaks.
        // See https://yaml.org/spec/1.2.2/#line-break-characters
      } else if (minor > 2) {
        // console.warn(`Warning: Future version ${versionString}. Treating as 1.2`);
      }
    } else if (name === 'TAG') {
      if (args.length !== 2) throw new Error(`Expected two args for %TAG directive`);
      const [handle, prefix] = args;

      if (TAG_HANDLE_EXPR.exec(handle) === null) throw new Error(`Invalid tag handle ${handle}`);
      if (TAG_PREFIX_EXPR.exec(prefix) === null) throw new Error(`Invalid tag prefix ${prefix}`);

      if (tagHandles.has(handle)) throw new Error(`Duplicate %TAG directive for handle ${handle}`);

      tagHandles.set(handle, prefix);
    } else {
      // console.warn(`Warning: Reserved directive ${text}`);
    }
  }
  return tagHandles;
}

const DEFAULT_TAG_HANDLES = {
  '!': '!',
  '!!': 'tag:yaml.org,2002:',
} as Partial<Record<string, string>>;

const CHOMPING_BEHAVIOR_LOOKUP = {
  '-': ChompingBehavior.STRIP,
  '+': ChompingBehavior.KEEP,
  '': ChompingBehavior.CLIP,
};

function buildDocument(text: string, body: AstNode, tagHandles: Map<string, string>) {
  function nodeText(node: AstNode) {
    return text.slice(...node.range);
  }

  return Y<SerializationNode, [AstNode]>((rec, outerNode) => {
    const { content: node, tagNode, anchorNode } = findContentAndProperties(outerNode);

    const tag = tagNode ? nodeTag(nodeText(tagNode), tagHandles) : null;
    const anchor = anchorNode ? nodeText(anchorNode).slice(1) : null;

    switch (CONTENT_NODE_TO_CLASS[node.name]) {
      case 'alias': return new Alias(nodeText(node).slice(1));

      case 'emptyScalar': return new SerializationScalar(tag ?? NonSpecificTag.question, '', anchor);
      case 'plainScalar': return new SerializationScalar(tag ?? NonSpecificTag.question, handlePlainScalarContent(nodeText(single(node.content))), anchor);
      case 'singleQuotedScalar': return new SerializationScalar(tag ?? NonSpecificTag.exclamation, handleSingleQuotedScalarContent(nodeText(node).slice(1, -1)), anchor);
      case 'doubleQuotedScalar': return new SerializationScalar(tag ?? NonSpecificTag.exclamation, handleDoubleQuotedScalarContent(nodeText(node).slice(1, -1)), anchor);

      case 'blockScalar':
        return new SerializationScalar(tag ?? NonSpecificTag.exclamation, blockScalarContent(node), anchor);

      case 'mapping': {
        const children = findMappingEntries(node).map(([k, v]) => [rec(k), rec(v)] as const);
        return new SerializationMapping(tag ?? NonSpecificTag.question, children, anchor);
      }

      case 'sequence': {
        const children = findSequenceEntries(node).map(rec);
        return new SerializationSequence(tag ?? NonSpecificTag.question, children, anchor);
      }

      default: throw new TypeError(`Unexpected node ${node.name}`);
    }
  })(body);

  function blockScalarContent(node: AstNode) {
    const {
      foldingIndicator,
      chompingIndicator,
      indentationIndicator,
      content,
    } = groupNodes(node.content, {
      return: {
        'foldingIndicator%': NODE_INFO.blockScalarFoldingIndicator,
        'indentationIndicator?%': NODE_INFO.blockScalarIndentationIndicator,
        'chompingIndicator%': NODE_INFO.blockScalarChompingIndicator,
        'content%': NODE_INFO.blockScalarContent,
      },
      recurse: ['c-b-block-header'],
      ignore: NODE_INFO.ignore,
    }, text);

    assertKeyOf(chompingIndicator, CHOMPING_BEHAVIOR_LOOKUP, `Unexpected chomping indicator ${chompingIndicator}`);
    const chompingBehavior = CHOMPING_BEHAVIOR_LOOKUP[chompingIndicator];

    return handleBlockScalarContent(
      content,
      foldingIndicator === '>',
      node.parameters.n as number,
      chompingBehavior,
      indentationIndicator === null ? null : parseDecimal(indentationIndicator),
    );
  }
}

function nodeTag(tagText: string, tagHandles: Map<string, string>) {
  if (tagText === '!') {
    return NonSpecificTag.exclamation;
  } else if (tagText.startsWith('!<')) {
    return tagText.slice(2, -1);
  } else {
    const i = (tagText.indexOf('!', 1) + 1) || 1;
    const handle = tagText.slice(0, i);
    const suffix = decodeURIComponent(tagText.slice(i));

    const prefix = tagHandles.get(handle) ?? DEFAULT_TAG_HANDLES[handle];
    if (prefix === undefined) {
      throw new Error(`Unknown tag handle ${handle}`);
    } else {
      return prefix + suffix;
    }
  }
}

function findContentAndProperties(node: AstNode) {
  return groupNodes([node], {
    return: {
      content: strictValues(CONTENT_NODE_CLASSES).flatMap(a => a),
      'tagNode?': NODE_INFO.tagProperty,
      'anchorNode?': NODE_INFO.anchorProperty,
    },
    recurse: [
      's-l+block-node',
      's-l+block-in-block',
      's-l+block-collection',
      's-l+block-indented',
      
      's-l+flow-in-block',
      'ns-flow-node',
      'ns-flow-yaml-node',
      'ns-flow-content',
      'c-flow-json-content',
      'c-flow-yaml-content',
      'ns-flow-yaml-content',
      'c-flow-json-node',

      'seq-space',

      's-l+block-scalar',

      'c-ns-properties',
      'block-collection-node-properties',
    ],
    ignore: NODE_INFO.ignore,
  });
}

function findSequenceEntries(node:AstNode) {
  return Array.from(iterateAst(node.content, {
    return: NODE_INFO.sequenceEntry,
    recurse: [
      'c-l-block-seq-entry',

      'in-flow',
      'ns-s-flow-seq-entries',
      'ns-flow-seq-entry',
    ],
    ignore: NODE_INFO.ignore,
  }));
}

function findMappingEntries(node: AstNode) {
  const pairNodes = Array.from(iterateAst([node], {
    return: NODE_INFO.mappingEntry,
    recurse: [
      ...CONTENT_NODE_CLASSES.mapping,
      'ns-s-flow-map-entries',
    ],
    ignore: NODE_INFO.ignore,
  }));

  return pairNodes.map(child => findPairKv(child));
}

function findPairKv(node: AstNode) {
  const kv = Array.from(iterateAst(node.content, {
    return: NODE_INFO.nodeWithProperties,
    recurse: [
      ...NODE_INFO.mappingEntry,

      'c-l-block-map-explicit-entry',
      'c-l-block-map-explicit-key',
      'l-block-map-explicit-value',
      'ns-l-block-map-implicit-entry',
      'ns-s-block-map-implicit-key',
      'c-l-block-map-implicit-value',

      'ns-flow-map-explicit-entry',
      'ns-flow-map-implicit-entry',
      'ns-flow-map-yaml-key-entry',
      'c-ns-flow-map-empty-key-entry',
      'c-ns-flow-map-json-key-entry',
      'c-ns-flow-map-separate-value',
      'c-ns-flow-map-adjacent-value',

      'ns-flow-pair-entry',
      'c-ns-flow-pair-json-key-entry',
      'ns-flow-pair-yaml-key-entry',

      'ns-s-implicit-yaml-key',
      'c-s-implicit-json-key',

    ],
    ignore: NODE_INFO.ignore,
  }));

  if (kv.length !== 2) throw new Error(kv.toString());

  return kv as [AstNode, AstNode];
}
