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
  singleOrNull,
  assertKeyOf,
  parseDecimal,
} from '@/util';

import {
  handlePlainScalarContent,
  handleSingleQuotedScalarContent,
  handleDoubleQuotedScalarContent,
  handleBlockScalarContent,
} from '../core/scalarContent';

import { iterateAst, groupNodes } from '../core/transformAst';

export function *astToSerializationTree(text: string, node: AstNode<'yaml-stream'>) {
  for (const { directives, body } of splitStream(node)) {
    const tagHandles = handleDirectives(text, directives);

    yield buildDocument(text, body, tagHandles);
  }
}

function *splitStream(node: AstNode<'yaml-stream'>) {
  const nodeStream = iterateAst(node.content, {
    return: [
      'any-document',
      'start-indicator-and-document',
    ],
    ignore: [
      'document-prefix',
      'document-suffix',
      'byte-order-mark',
      'comment-line',
    ],
  });

  for (const node of nodeStream) {
    const {
      directiveLine,
      blockNode,
      emptyNode,
    } = groupNodes(node.content, {
      return: [
        'directive-line*',
        'block-node*',
        'empty-node*',
      ],
      recurse: [
        'directives-and-document',
        'start-indicator-and-document',
        'bare-document',
      ],
      ignore: [
        'comment-lines',
        'document-start-indicator',
      ],
    });

    const body = single([...blockNode, ...emptyNode]);
    const directives = directiveLine.map(directiveAndComments =>
      single(iterateAst(directiveAndComments.content, {
        return: [
          'yaml-directive-line',
          'tag-directive-line',
          'reserved-directive-line',
        ],
        ignore: ['comment-lines'],
      }))
    );

    yield { directives, body };
  }
}

const YAML_VERSION_EXPR = /^(\d+)\.(\d+)$/;
const TAG_HANDLE_EXPR = /^!([-A-Za-z0-9]*!)?$/;
const TAG_PREFIX_EXPR = /^(?:[-A-Za-z0-9#;/?:@&=+$_.!~*'()]|%\p{Hex_Digit}{2})(?:[-A-Za-z0-9#;/?:@&=+$,_.!~*'()[\]]|%\p{Hex_Digit}{2})*$/u;

function handleDirectives(text: string, directives: readonly AstNode[]) {
  let hasYamlDirective = false;
  const tagHandles = new Map<string, string>();

  for (const directive of directives) {
    const directiveText = text.slice(...directive.range);
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

function Y<R, T extends unknown[]>(f: (rec: (...arg: T) => R, ...arg: T) => R) {
  return function rec(...arg: T): R {
    return f(rec, ...arg);
  };
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

    const tag = tagNode ? nodeTag(tagNode) : null;
    const anchor = anchorNode ? nodeText(anchorNode).slice(1) : null;

    switch (node.name) {
      case 'alias-node': return new Alias(nodeText(node).slice(1));

      case 'empty-node': return new SerializationScalar(tag ?? NonSpecificTag.question, '', anchor);
      case 'flow-plain-scalar': return new SerializationScalar(tag ?? NonSpecificTag.question, handlePlainScalarContent(nodeText(single(node.content))), anchor);
      case 'single-quoted-scalar': return new SerializationScalar(tag ?? NonSpecificTag.exclamation, handleSingleQuotedScalarContent(nodeText(single(node.content))), anchor);
      case 'double-quoted-scalar': return new SerializationScalar(tag ?? NonSpecificTag.exclamation, handleDoubleQuotedScalarContent(nodeText(single(node.content))), anchor);

      case 'block-literal-scalar': case 'block-folded-scalar':
        return new SerializationScalar(tag ?? NonSpecificTag.exclamation, blockScalarContent(node), anchor);

      case 'block-mapping': case 'compact-mapping': case 'flow-mapping': case 'flow-pair': {
        const children = findMappingEntries(node).map(([k, v]) => [rec(k), rec(v)] as const);
        return new SerializationMapping(tag ?? NonSpecificTag.question, children, anchor);
      }

      case 'block-sequence': case 'compact-sequence': case 'flow-sequence': {
        const children = findSequenceEntries(node).map(rec);
        return new SerializationSequence(tag ?? NonSpecificTag.question, children, anchor);
      }

      default: throw new TypeError(`Unexpected node ${node.name}`);
    }
  })(body);

  function nodeTag(node: AstNode<'tag-property'>) {
    const tagContentNode = single(node.content);

    switch (tagContentNode.name) {
      case 'verbatim-tag': return nodeText(tagContentNode).slice(2, -1);
      case 'shorthand-tag': {
        const text = nodeText(tagContentNode);
        const i = (text.indexOf('!', 1) + 1) || 1;
        const handle = text.slice(0, i);
        const suffix = decodeURIComponent(text.slice(i));

        const prefix = tagHandles.get(handle) ?? DEFAULT_TAG_HANDLES[handle];
        if (prefix === undefined) {
          throw new Error(`Unknown tag handle ${handle}`);
        } else {
          return prefix + suffix;
        }
      }
      case 'non-specific-tag': return NonSpecificTag.exclamation;

      default: throw new TypeError(tagContentNode.name);
    }
  }

  function blockScalarContent(node: AstNode) {
    const {
      blockScalarChompingIndicator,
      blockScalarIndentationIndicator,
      literalScalarContent,
      foldedScalarContent,
    } = groupNodes(node.content, {
      return: [
        'block-scalar-indentation-indicator?%',
        'block-scalar-chomping-indicator%',
        'literal-scalar-content*',
        'folded-scalar-content*',
      ],
      recurse: [
        'block-literal-scalar',
        'block-folded-scalar',
        'block-scalar-indicators',
      ],
      ignore: [
        'separation-characters',
        'comment-line',
      ],
    }, text);

    const contentNode = single([...literalScalarContent, ...foldedScalarContent]);
    const content = nodeText(contentNode);

    assertKeyOf(blockScalarChompingIndicator, CHOMPING_BEHAVIOR_LOOKUP, `Unexpected chomping indicator ${blockScalarChompingIndicator}`);
    const chompingBehavior = CHOMPING_BEHAVIOR_LOOKUP[blockScalarChompingIndicator];

    return handleBlockScalarContent(
      content,
      node.name === 'block-folded-scalar',
      node.parameters.n as number,
      chompingBehavior,
      blockScalarIndentationIndicator === null ? null : parseDecimal(blockScalarIndentationIndicator),
    );
  }
}

function findContentAndProperties(node: AstNode) {
  const children = Array.from(iterateAst([node], {
    return: [
      'alias-node',
      'empty-node',

      'block-sequence',
      'compact-sequence',
      'block-mapping',
      'compact-mapping',
      'flow-pair',

      'flow-plain-scalar',
      'flow-sequence',
      'flow-mapping',
      'single-quoted-scalar',
      'double-quoted-scalar',

      'block-literal-scalar',
      'block-folded-scalar',

      'node-properties',
      'block-collection-node-properties',
    ],
    recurse: [
      'block-node',
      'block-node-in-a-block-node',
      'block-indented-node',
      'block-collection',
      'block-sequence-context',
      'block-mapping-context',
      'block-scalar',

      'flow-node-in-a-block-node',
      'flow-node',
      'flow-yaml-node',
      'flow-content',
      'flow-json-content',
      'flow-yaml-content',

      'flow-json-node',
    ],
    ignore: [
      'separation-characters',
      'comment-lines',
      'indentation-spaces',
    ],
  }));

  const content = single(children.filter(node => node.name !== 'node-properties' && node.name !== 'block-collection-node-properties'));

  const nodePropertiesParent = singleOrNull(children.filter(node => node.name === 'node-properties' || node.name === 'block-collection-node-properties'));

  const { anchorProperty, tagProperty } = groupNodes(nodePropertiesParent?.content ?? [], {
    return: ['anchor-property?', 'tag-property?'],
    recurse: ['node-properties', 'block-collection-node-properties'],
    ignore: ['separation-characters'],
  });

  return {
    content,
    tagNode: tagProperty,
    anchorNode: anchorProperty,
  };
}

function findSequenceEntries(node:AstNode) {
  return Array.from(iterateAst(node.content, {
    return: [
      'block-indented-node',
      'flow-pair',
      'flow-node',
    ],
    recurse: [
      'block-sequence-entry',
      'flow-sequence-context',
      'flow-sequence-entries',
      'flow-sequence-entry',
    ],
    ignore: [
      'indentation-spaces',
      'separation-characters',
    ],
  }));
}

function findMappingEntries(node: AstNode) {
  const pairNodes = Array.from(iterateAst([node], {
    return: ['block-mapping-entry', 'flow-mapping-entry', 'flow-pair'],
    recurse: [
      'block-mapping',
      'compact-mapping',
      'flow-mapping',
      'flow-mapping-context', 'flow-mapping-entries',
    ],
    ignore: ['indentation-spaces', 'separation-characters'],
  }));

  return pairNodes.map(child => findPairKv(child));
}

function findPairKv(node: AstNode) {
  const kv = Array.from(iterateAst(node.content, {
    return: [
      'block-node',
      'block-indented-node',
      'empty-node',
      'flow-node',
      'flow-json-node',
      'flow-yaml-node',
    ],
    recurse: [
      'block-mapping-explicit-entry',
      'block-mapping-explicit-key',
      'block-mapping-explicit-value',
      'block-mapping-implicit-entry',
      'block-mapping-implicit-key',
      'block-mapping-implicit-value',
      'implicit-json-key',
      'implicit-yaml-key',

      'flow-mapping-explicit-entry',
      'flow-mapping-implicit-entry',

      'flow-mapping-json-key-entry',
      'flow-mapping-yaml-key-entry',
      'flow-mapping-empty-key-entry',
      'flow-mapping-adjacent-value',
      'flow-mapping-separate-value',

      'flow-pair-entry',
      'flow-pair-yaml-key-entry',
      'flow-pair-empty-key-entry',
      'flow-pair-json-key-entry',
    ],
    ignore: [
      'indentation-spaces',
      'separation-blanks',
      'separation-characters',
      'comment-lines',
    ],
  }));

  if (kv.length !== 2) throw new Error(kv.toString());

  return kv as [AstNode, AstNode];
}
