import { AstNode } from "./ast";

import {
  SerializationScalar,
  SerializationSequence,
  SerializationMapping,
  NonSpecificTag,
  type SerializationNode,
  Alias,
} from "@/nodes";

import {
  single,
  singleOrNull,
  strictFromEntries,
  fromSnake,
  toCamel,
  type FromSnake,
  type ToCamel,
} from "@/util";

import {
  handlePlainScalarContent,
  handleSingleQuotedScalarContent,
  handleDoubleQuotedScalarContent,
  handleBlockScalarContent,
} from "./scalarContent";

export function *astToSerializationTree(text: string, nodes: AstNode<'yaml-stream'>): Generator<SerializationNode> {
  const nodeStream = iterateAst(nodes.content, {
    return: [
      'tag-directive-line',
      'yaml-directive-line',
      'reserved-directive-line',
      'document-start-indicator',
      'bare-document',
      'empty-node',
      'document-end-indicator',
    ],
    recurse: [
      'start-indicator-and-document',
      'document-prefix',
      'document-suffix',
      'any-document',
      'directives-and-document',
      'directive-line',
    ],
    ignore: [
      'comment-lines',
      'comment-line',
      'separation-blanks',
      'line-ending',
      'blanks-and-comment-line',
    ],
  });

  let op = new AstToSerializationTreeOperation(text);

  for (const node of nodeStream) {
    switch (node.name) {
      case 'yaml-directive-line':
      case 'tag-directive-line':
      case 'reserved-directive-line': {
        // For better error reporting, ignore node type and look at directive name.
        op.handleDirective(node);
        break;
      }

      case 'empty-node': {
        yield op.buildNode(node);
        op = new AstToSerializationTreeOperation(text);
        break;
      }

      case 'bare-document': {
        yield op.buildNode(single(node.content));
        op = new AstToSerializationTreeOperation(text);
        break;
      }

      case 'yaml-directive-line': break;
      case 'document-start-indicator': break;
      case 'document-end-indicator': break;

      default: throw new TypeError(node.name);
    }
  }
}

const YAML_VERSION_EXPR = /^(\d+)\.(\d+)$/;
const TAG_HANDLE_EXPR = /^!([-A-Za-z0-9]*!)?$/;
const TAG_PREFIX_EXPR = /^(?:[-A-Za-z0-9#;/?:@&=+$_.!~*'()]|%\p{Hex_Digit}{2})(?:[-A-Za-z0-9#;/?:@&=+$,_.!~*'()[\]]|%\p{Hex_Digit}{2})*$/u;

const DEFAULT_TAG_HANDLES = {
  '!': '!',
  '!!': 'tag:yaml.org,2002:',
} as Partial<Record<string, string>>;

class AstToSerializationTreeOperation {
  readonly text: string;
  readonly tagHandles = new Map<string, string>();
  hasYamlDirective = false;

  constructor(text: string) {
    this.text = text;
  }

  nodeText(node: AstNode) {
    return this.text.slice(...node.range);
  }

  handleDirective(node: AstNode) {
    const text = this.nodeText(node);
    const [name, ...args] = text.split(/[ \t]+/g);

    if (name === 'YAML') {
      if (this.hasYamlDirective) {
        throw new Error(`Multiple %YAML directives`);
      } else {
        this.hasYamlDirective = true;
      }
      if (args.length !== 1) throw new Error(`Expect one arg for %YAML directive`);
      const versionString = args[0];

      const versionMatch = YAML_VERSION_EXPR.exec(versionString);
      if (versionMatch === null) throw new Error(`Invalid YAML version ${versionString}`);

      const major = Number(versionMatch[1]);
      const minor = Number(versionMatch[2]);

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

      if (this.tagHandles.has(handle)) throw new Error(`Duplicate %TAG directive for handle ${handle}`);

      this.tagHandles.set(handle, prefix);
    } else {
      // console.warn(`Warning: Reserved directive ${text}`);
    }
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

        'alias-node',
      ],
      ignore: [
        'separation-characters',
        'comment-lines',
        'indentation-spaces',
      ],
    }));

    const content = single(children.filter(node => node.name !== 'node-properties' && node.name !== 'block-collection-node-properties'));

    let ret = this.nodeValue(content);

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

          const { annotationName, annotationArguments } = groupNodes(property.content, {
            return: ['annotation-name', 'annotation-arguments'],
          });

          const name = this.nodeText(single(annotationName));

          outerNode = new SerializationMapping('tag:yaml.org,2002:annotation', [
            [
              new SerializationScalar('tag:yaml.org,2002:str', 'name'),
              new SerializationScalar('tag:yaml.org,2002:str', name),
            ],
            [
              new SerializationScalar('tag:yaml.org,2002:str', 'value'),
              outerNode,
            ],
          ]);

          const argNode = singleOrNull(annotationArguments);
          if (argNode !== null) {
            const args = this.flowSequenceContent(argNode);
            outerNode.content.push([
              new SerializationScalar('tag:yaml.org,2002:str', 'arguments'),
              new SerializationSequence('tag:yaml.org,2002:seq', args),
            ]);
          }
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

  nodeAnchor(node: AstNode<'anchor-property'>) {
    const { anchorName } = groupNodes(node.content, {
      return: ['anchor-name'],
    });
    return this.nodeText(single(anchorName));
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
      };
      case 'non-specific-tag': return NonSpecificTag.exclamation;

      default: throw new TypeError(tagContentNode.name);
    }
  }

  nodeValue(
    node: AstNode,
  ) {
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

      case 'flow-sequence':
        return new SerializationSequence(NonSpecificTag.question, this.flowSequenceContent(node));
      case 'block-sequence':
      case 'compact-sequence':
        return new SerializationSequence(NonSpecificTag.question, this.blockSequenceContent(node));

      case 'flow-mapping':
        return new SerializationMapping(NonSpecificTag.question, this.flowMappingContent(node));
      case 'block-mapping':
      case 'compact-mapping':
        return new SerializationMapping(NonSpecificTag.question, this.blockMappingContent(node));

      default: throw new TypeError(node.name);
    }
  }

  blockScalarContent(node: AstNode) {
    const {
      blockScalarIndentationIndicator,
      literalScalarContent,
      foldedScalarContent,
    } = groupNodes(node.content, {
      return: [
        'block-scalar-indentation-indicator',
        'block-scalar-chomping-indicator',
        'literal-scalar-content',
        'folded-scalar-content',
      ],
      recurse: [
        'block-literal-scalar',
        'block-folded-scalar',
        'block-scalar-indicators',
      ],
      ignore: [
        'separation-characters',
        'comment-line',
        'block-scalar-chomping-indicator',
      ],
    });

    const indentationIndicatorNode = singleOrNull(blockScalarIndentationIndicator);
    const indentationIndicator = indentationIndicatorNode ? this.nodeText(indentationIndicatorNode) : '';
    const contentNode = single([...literalScalarContent, ...foldedScalarContent]);

    const content = this.nodeText(contentNode);

    return handleBlockScalarContent(
      content,
      node.name === 'block-folded-scalar',
      node.parameters.n!,
      contentNode.parameters.t!,
      indentationIndicator === '' ? null : Number(indentationIndicator),
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
      return: ['block-indented-node'],
      recurse: ['block-sequence-entry'],
      ignore: ['indentation-spaces'],
    });

    return blockIndentedNode.map(child => this.buildNode(child));
  }

  blockMappingContent(node: AstNode) {
    const { blockMappingEntry } = groupNodes(node.content, {
      return: ['block-mapping-entry'],
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

function *iterateAst<T extends string>(
  nodes: Iterable<AstNode>,
  names: {
    return: T[],
    recurse?: string[],
    ignore?: string[],
  },
): Generator<AstNode<T>> {
  for (const node of nodes) {
    if ((names.return as string[]).includes(node.name)) {
      yield node as AstNode<T>;
    } else if (names.recurse?.includes(node.name)) {
      yield* iterateAst(node.content, names);
    } else if (names.ignore?.includes(node.name)) {
      // pass
    } else {
      throw new Error(`Encountered unexpected AST node named ${node.name}`);
    }
  }
}

function groupNodes<T extends string>(
  nodes: Iterable<AstNode>,
  names: {
    return: T[],
    recurse?: string[],
    ignore?: string[],
  },
) {
  const ret = strictFromEntries(
    names.return.map(
      name => [
        toCamel(fromSnake(name)),
        [] as AstNode<T>[],
      ] as const
    )
  );

  for (const node of iterateAst(nodes, names)) {
    const name = toCamel(fromSnake(node.name));
    ret[name].push(node);
  }

  return ret as unknown as {
    [K in T as ToCamel<FromSnake<K>>]: AstNode<K>[]
  };
}
