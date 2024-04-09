import { AstNode, ChompingBehavior } from '../core/ast';

import {
  Alias,
  SerializationScalar,
  SerializationSequence,
  SerializationMapping,
  NonSpecificTag,
  ScalarStyle,
  CollectionStyle,
  type SerializationNode,
  type SerializationTag,
} from '@/nodes';

import {
  assertKeyOf,
  parseDecimal,
} from '@/util';

import {
  handlePlainScalarContent,
  handleSingleQuotedScalarContent,
  handleDoubleQuotedScalarContent,
  handleBlockScalarContent,
} from '../core/scalarContent';

import { iterateAst as oldIterateAst, groupNodes as oldGroupNodes } from '../core/transformAst';

import {
  CONTENT_CLASS_NAMES, ContentNodeClass, NODE_PROPERTY_CLASS_NAMES,
  type NodeClass, type NodePropertyClass, type NormalizedAst,
} from './normalizeAst';

const YAML_VERSION_EXPR = /^(\d+)\.(\d+)$/;
const TAG_HANDLE_EXPR = /^!([-A-Za-z0-9]*!)?$/;
const TAG_PREFIX_EXPR = /^(?:[-A-Za-z0-9#;/?:@&=+$_.!~*'()]|%\p{Hex_Digit}{2})(?:[-A-Za-z0-9#;/?:@&=+$,_.!~*'()[\]]|%\p{Hex_Digit}{2})*$/u;

const CHOMPING_BEHAVIOR_LOOKUP = {
  '-': ChompingBehavior.STRIP,
  '+': ChompingBehavior.KEEP,
  '': ChompingBehavior.CLIP,
};

function iterateAst<
  TThisName extends NodeClass,
>(
  nodes: readonly NormalizedAst<TThisName>[],
  nodeClasses: readonly NodeClass[],
) {
  return oldIterateAst(nodes, { return: nodeClasses });
}

function groupNodes<
  TName extends NodeClass,
  const TReturnMap extends { [K in string]: readonly NodeClass[] },
>(
  nodes: readonly NormalizedAst<TName>[],
  nodeClasses: TReturnMap,
  nodeText?: (node: AstNode) => string,
) {
  return oldGroupNodes(nodes, {
    return: nodeClasses,
  }, nodeText);
}

export function astToSerializationTree(
  node: NormalizedAst,
  nodeText: (node: AstNode) => string,
) {
  return new AstToSerializationTree(nodeText).handleStream(node);
}

class AstToSerializationTree {
  readonly nodeText: (node: AstNode) => string;

  constructor(nodeText: (node: AstNode) => string) {
    this.nodeText = nodeText;
  }

  *handleStream(node: NormalizedAst) {
    for (const document of iterateAst(node.content, ['document'])) {
      const { directive, nodeWithProperties } = groupNodes(document.content, {
        'directive*': ['directive'],
        'nodeWithProperties': ['nodeWithProperties', 'emptyScalar'],
      });
      const tagHandles = this.handleDirectives(directive.map(node => this.nodeText(node)));

      yield this.buildNode(nodeWithProperties, tagHandles);
    }
  }

  handleDirectives(directives: readonly string[]) {
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

  buildNode(body: NormalizedAst, tagHandles: Map<string, string>): SerializationNode {
    if (body === undefined) throw new Error();
    const { contentNode, nodeProperty } = groupNodes([body], {
      contentNode: CONTENT_CLASS_NAMES,
      'nodeProperty*': NODE_PROPERTY_CLASS_NAMES,
    });

    const { tag, anchor, annotations } = this.handleNodeProperties(nodeProperty, tagHandles);

    let node = this.buildContent(contentNode, tagHandles, tag, anchor);

    for (const { annotationName, annotationArguments, anchor } of annotations) {
      const args = annotationArguments
        ? iterateAst(annotationArguments.content, ['nodeWithProperties', 'flowPair'])
          .map(arg => this.buildNode(arg, tagHandles))
        : [];

      node = new SerializationMapping('tag:yaml.org,2002:annotation', [
        [
          new SerializationScalar('tag:yaml.org,2002:str', 'name'),
          new SerializationScalar('tag:yaml.org,2002:str', annotationName),
        ],
        [
          new SerializationScalar('tag:yaml.org,2002:str', 'arguments'),
          new SerializationSequence('tag:yaml.org,2002:seq', args),
        ],
        [
          new SerializationScalar('tag:yaml.org,2002:str', 'value'),
          node,
        ],
      ], anchor);
    }

    return node;
  }

  handleNodeProperties(
    nodeProperties: readonly NormalizedAst<NodePropertyClass>[],
    tagHandles: Map<string, string>,
  ): {
    tag: SerializationTag | null,
    anchor: string | null,
    annotations: {
      annotationName: string,
      annotationArguments: NormalizedAst | null,
      anchor: string | null,
    }[],
  } {
    let tag: SerializationTag | null = null;
    let anchor: string | null = null;
    const annotations: {
      annotationName: string,
      annotationArguments: NormalizedAst | null,
      anchor: string | null,
    }[] = [];

    for (const property of nodeProperties) {
      const nodeClass = property.name;
      if (nodeClass === 'tagProperty') {
        if (tag !== null) throw new Error(`multiple tag properties`);
        tag = nodeTag(this.nodeText(property), tagHandles);
      } else if (nodeClass === 'anchorProperty') {
        if (anchor !== null) throw new Error(`multiple anchor properties`);
        anchor = this.nodeText(property).slice(1);
      } else if (nodeClass === 'annotationProperty') {
        if (tag !== null) throw new Error(`tag property before annotation property`);
        const annotationInfo = groupNodes(property.content, {
          'annotationName%': ['annotationName'],
          'annotationArguments?': ['annotationArguments'],
        }, this.nodeText);
        annotations.unshift({ ...annotationInfo, anchor });
        anchor = null;
      } else {
        throw new TypeError(nodeClass);
      }
    }

    return { tag, anchor, annotations } as const;
  }

  buildContent(
    contentNode: NormalizedAst<ContentNodeClass>,
    tagHandles: Map<string, string>,
    tag: SerializationTag | null,
    anchor: string | null,
  ): SerializationNode {
    const nodeClass = contentNode.name;
    switch (nodeClass) {
      case 'alias': return new Alias(this.nodeText(contentNode).slice(1));

      case 'emptyScalar':
        return new SerializationScalar(tag ?? NonSpecificTag.question, '', anchor, {
          style: ScalarStyle.plain,
        });
      case 'plainScalar': {
        const content = handlePlainScalarContent(this.nodeText(contentNode));
        return new SerializationScalar(tag ?? NonSpecificTag.question, content, anchor, {
          style: ScalarStyle.plain,
        });
      }
      case 'singleQuotedScalar': {
        const content = handleSingleQuotedScalarContent(this.nodeText(contentNode).slice(1, -1));
        return new SerializationScalar(tag ?? NonSpecificTag.exclamation, content, anchor, {
          style: ScalarStyle.single,
        });
      }
      case 'doubleQuotedScalar': {
        const content = handleDoubleQuotedScalarContent(this.nodeText(contentNode).slice(1, -1));
        return new SerializationScalar(tag ?? NonSpecificTag.exclamation, content, anchor, {
          style: ScalarStyle.double,
        });
      }
      case 'literalScalar': case 'foldedScalar': {
        const {
          blockScalarChompingIndicator,
          blockScalarIndentationIndicator,
          blockScalarContent,
        } = groupNodes(contentNode.content, {
          'blockScalarIndentationIndicator?%': ['blockScalarIndentationIndicator'],
          'blockScalarChompingIndicator%': ['blockScalarChompingIndicator'],
          'blockScalarContent%': ['blockScalarContent'],
        }, this.nodeText);

        assertKeyOf(blockScalarChompingIndicator, CHOMPING_BEHAVIOR_LOOKUP, `Unexpected chomping indicator ${blockScalarChompingIndicator}`);
        const chompingBehavior = CHOMPING_BEHAVIOR_LOOKUP[blockScalarChompingIndicator];

        const content = handleBlockScalarContent(
          blockScalarContent,
          nodeClass === 'foldedScalar',
          contentNode.parameters.n as number,
          chompingBehavior,
          blockScalarIndentationIndicator === null ? null : parseDecimal(blockScalarIndentationIndicator),
        );

        return new SerializationScalar(tag ?? NonSpecificTag.exclamation, content, anchor, {
          style: nodeClass === 'foldedScalar' ? ScalarStyle.folded : ScalarStyle.block,
        });
      }

      case 'blockMapping':
      case 'flowMapping':
      case 'flowPair': {
        const pairs = contentNode.name === 'flowPair'
          ? [contentNode]
          : iterateAst([contentNode], ['mappingEntry']);

        const children = pairs
          .map(child => {
            const x = iterateAst(child.content, ['nodeWithProperties', 'emptyScalar']);
            if (x.length !== 2) {
              console.error(this.nodeText(child));
              console.error(child);
              throw new Error();
            }
            return [
              this.buildNode(x[0], tagHandles),
              this.buildNode(x[1], tagHandles),
            ] as const;
          });

        return new SerializationMapping(tag ?? NonSpecificTag.question, children, anchor, {
          style: nodeClass === 'blockMapping' ? CollectionStyle.block : CollectionStyle.flow
        });
      }

      case 'blockSequence':
      case 'flowSequence': {
        const children = iterateAst(contentNode.content, ['nodeWithProperties', 'flowPair'])
          .map(child => this.buildNode(child, tagHandles));

        return new SerializationSequence(tag ?? NonSpecificTag.question, children, anchor, {
          style: nodeClass === 'blockSequence' ? CollectionStyle.block : CollectionStyle.flow
        });
      }

      default: throw new TypeError(`Unexpected node ${nodeClass}`);
    }
  }
}

const DEFAULT_TAG_HANDLES = {
  '!': '!',
  '!!': 'tag:yaml.org,2002:',
} as Partial<Record<string, string>>;

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
