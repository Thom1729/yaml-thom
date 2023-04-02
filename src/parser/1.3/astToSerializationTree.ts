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
    yield buildDocument(text, directives, body);
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

function buildDocument(text: string, directives: readonly AstNode[], body: AstNode) {
  const tagHandles = handleDirectives(text, directives);

  const op = new AstToSerializationTreeOperation(text, tagHandles);
  return op.buildNode(body);
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

class AstToSerializationTreeOperation {
  readonly text: string;
  readonly tagHandles;

  constructor(text: string, tagHandles: Map<string, string>) {
    this.text = text;
    this.tagHandles = tagHandles;
  }

  nodeText(node: AstNode) {
    return this.text.slice(...node.range);
  }

  buildNode(node: AstNode): SerializationNode {
    if (node.name === 'empty-node') {
      return new SerializationScalar(NonSpecificTag.question, '');
    }
    const children = Array.from(iterateAst(node.content, {
      return: [
        'alias-node',
        'empty-node',
        'node-properties',
        'block-collection-node-properties',

        'block-sequence',
        'compact-sequence',
        'block-mapping',
        'compact-mapping',

        'flow-plain-scalar',
        'flow-sequence',
        'flow-mapping',
        'single-quoted-scalar',
        'double-quoted-scalar',

        'block-literal-scalar',
        'block-folded-scalar',
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
      ],
      ignore: [
        'separation-characters',
        'comment-lines',
        'indentation-spaces',
      ],
    }));

    const content = single(children.filter(node => node.name !== 'node-properties' && node.name !== 'block-collection-node-properties'));

    const ret = this.nodeValue(content);

    const nodePropertiesParent = singleOrNull(children.filter(node => node.name === 'node-properties' || node.name === 'block-collection-node-properties'));
    const nodeProperties = Array.from(iterateAst(nodePropertiesParent?.content ?? [], {
      return: ['annotation-property','anchor-property', 'tag-property'],
      ignore: ['separation-characters'],
      recurse: ['node-properties', 'block-collection-node-properties'],
    })).reverse();

    return this.handleNodeProperties(ret, nodeProperties);
  }

  handleNodeProperties(
    node: SerializationNode,
    properties: AstNode<'annotation-property' | 'anchor-property' | 'tag-property'>[],
  ) {
    let outerNode = node;

    let hasTag = false;
    let hasAnchor = false;
    let hasAnnotation = false;

    for (const property of properties) {
      switch (property.name) {
        case 'annotation-property': {
          hasAnchor = false;
          hasTag = false;
          hasAnnotation = true;

          outerNode = this.buildAnnotation(property, outerNode);
          break;
        }
        case 'anchor-property': {
          if (hasAnchor) throw new Error(`Multiple anchors`);
          if (outerNode.kind === 'alias') throw new Error(`Anchor on alias`);
          outerNode.anchor = this.nodeAnchor(property as AstNode<'anchor-property'>);
          break;
        }
        case 'tag-property': {
          if (hasTag) throw new Error(`Multiple tags`);
          if (outerNode.kind === 'alias') throw new Error(`Tag on alias`);
          if (hasAnnotation) throw new Error(`Tag on annotation`);
          outerNode.tag = this.nodeTag(property as AstNode<'tag-property'>);
          break;
        }
      }
    }

    return outerNode;
  }

  buildAnnotation(node: AstNode, child: SerializationNode) {
    const { annotationName, annotationArguments } = groupNodes(node.content, {
      return: ['annotation-name%', 'annotation-arguments?'],
    }, this.text);

    const ret = new SerializationMapping('tag:yaml.org,2002:annotation', [
      [
        new SerializationScalar('tag:yaml.org,2002:str', 'name'),
        new SerializationScalar('tag:yaml.org,2002:str', annotationName),
      ],
      [
        new SerializationScalar('tag:yaml.org,2002:str', 'value'),
        child,
      ],
    ]);

    if (annotationArguments !== null) {
      const args = this.flowSequenceContent(annotationArguments);
      ret.content.push([
        new SerializationScalar('tag:yaml.org,2002:str', 'arguments'),
        new SerializationSequence('tag:yaml.org,2002:seq', args),
      ]);
    }

    return ret;
  }

  nodeAnchor(node: AstNode<'anchor-property'>) {
    const { anchorName } = groupNodes(node.content, {
      return: ['anchor-name%'],
    }, this.text);
    return anchorName;
  }

  nodeTag(node: AstNode<'tag-property'>) {
    const tagContentNode = single(node.content);

    switch (tagContentNode.name) {
      case 'verbatim-tag': return this.nodeText(tagContentNode).slice(2, -1);
      case 'shorthand-tag': {
        const text = this.nodeText(tagContentNode);
        const i = (text.indexOf('!', 1) + 1) || 1;
        const handle = text.slice(0, i);
        const suffix = decodeURIComponent(text.slice(i));

        const prefix = this.tagHandles.get(handle) ?? DEFAULT_TAG_HANDLES[handle];
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

  nodeValue(node: AstNode) {
    switch (node.name) {
      case 'alias-node': return new Alias(this.nodeText(node).slice(1));

      case 'empty-node': return new SerializationScalar(NonSpecificTag.question, '');

      case 'flow-plain-scalar': {
        const content = this.nodeText(single(node.content));
        return new SerializationScalar(NonSpecificTag.question, handlePlainScalarContent(content));
      }
      case 'single-quoted-scalar': {
        const content = this.nodeText(single(node.content));
        return new SerializationScalar(NonSpecificTag.exclamation, handleSingleQuotedScalarContent(content));
      }
      case 'double-quoted-scalar': {
        const content = this.nodeText(single(node.content));
        return new SerializationScalar(NonSpecificTag.exclamation, handleDoubleQuotedScalarContent(content));
      }

      case 'block-literal-scalar':
      case 'block-folded-scalar':
        return new SerializationScalar(NonSpecificTag.exclamation, this.blockScalarContent(node));
      case 'block-sequence':
      case 'compact-sequence':
        return new SerializationSequence(NonSpecificTag.question, this.blockSequenceContent(node));
      case 'block-mapping':
      case 'compact-mapping':
        return new SerializationMapping(NonSpecificTag.question, this.blockMappingContent(node));

      case 'flow-sequence':
        return new SerializationSequence(NonSpecificTag.question, this.flowSequenceContent(node));
      case 'flow-mapping':
        return new SerializationMapping(NonSpecificTag.question, this.flowMappingContent(node));

      default: throw new TypeError(node.name);
    }
  }

  blockScalarContent(node: AstNode) {
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
    }, this.text);

    const contentNode = single([...literalScalarContent, ...foldedScalarContent]);
    const content = this.nodeText(contentNode);

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

  flowSequenceContent(node: AstNode) {
    return Array.from(iterateAst(node.content, {
      return: [
        'flow-pair',
        'flow-node',
      ],
      recurse: [
        'flow-sequence-context',
        'flow-sequence-entries',
        'flow-sequence-entry',
      ],
      ignore: [
        'separation-characters',
      ],
    })).map(child => {
      if (child.name === 'flow-node') {
        return this.buildNode(child);
      } else {
        return new SerializationMapping(
          NonSpecificTag.question,
          [this.blockMappingEntry(child as AstNode<'flow-pair'>)]
        );
      }
    });
  }

  flowMappingContent(node: AstNode) {
    return Array.from(iterateAst(node.content, {
      return: [
        'flow-mapping-entry',
      ],
      recurse: [
        'flow-mapping-context',
        'flow-mapping-entries',
      ],
      ignore: [
        'separation-characters',
      ],
    })).map(entry => this.blockMappingEntry(entry));
  }

  blockSequenceContent(node: AstNode) {
    const { blockIndentedNode } = groupNodes(node.content, {
      return: ['block-indented-node*'],
      recurse: ['block-sequence-entry'],
      ignore: ['indentation-spaces'],
    });

    return blockIndentedNode.map(child => this.buildNode(child));
  }

  blockMappingContent(node: AstNode) {
    const { blockMappingEntry } = groupNodes(node.content, {
      return: ['block-mapping-entry*'],
      ignore: ['indentation-spaces'],
    });

    return blockMappingEntry.map(child => this.blockMappingEntry(child));
  }

  blockMappingEntry(node: AstNode<'block-mapping-entry'|'flow-mapping-entry'|'flow-pair'>) {
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

    const [k, v] = kv;

    return [
      this.buildNode(k),
      this.buildNode(v),
    ] as const;
  }
}
