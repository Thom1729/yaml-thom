import { AstNode, ChompingBehavior } from '../core/ast';

import {
  Alias,
  SerializationScalar,
  SerializationSequence,
  SerializationMapping,
  NonSpecificTag,
  type SerializationNode,
  SerializationTag,
} from '@/nodes';

import {
  assertKeyOf,
  parseDecimal,
  strictFromEntries,
} from '@/util';

import {
  handlePlainScalarContent,
  handleSingleQuotedScalarContent,
  handleDoubleQuotedScalarContent,
  handleBlockScalarContent,
} from '../core/scalarContent';

import { iterateAst, groupNodes, unquantify, type Quantify } from '../core/transformAst';

const CONTENT_CLASS_NAMES = [
  'alias',
  'emptyScalar',
  'plainScalar',
  'singleQuotedScalar',
  'doubleQuotedScalar',
  'literalScalar',
  'foldedScalar',
  'mapping',
  'sequence',
] as const;

type ContentNodeClass = (typeof CONTENT_CLASS_NAMES)[number];
type NodeClass =
| ContentNodeClass
| 'document'
| 'directive'
| 'nodeWithProperties'
| 'tagProperty'
| 'anchorProperty'
| 'blockScalarIndentationIndicator'
| 'blockScalarChompingIndicator'
| 'blockScalarContent'
| 'mappingEntry'
| 'ignore';

export type NodeClasses = Record<NodeClass, readonly string[]>;

const YAML_VERSION_EXPR = /^(\d+)\.(\d+)$/;
const TAG_HANDLE_EXPR = /^!([-A-Za-z0-9]*!)?$/;
const TAG_PREFIX_EXPR = /^(?:[-A-Za-z0-9#;/?:@&=+$_.!~*'()]|%\p{Hex_Digit}{2})(?:[-A-Za-z0-9#;/?:@&=+$,_.!~*'()[\]]|%\p{Hex_Digit}{2})*$/u;

const CHOMPING_BEHAVIOR_LOOKUP = {
  '-': ChompingBehavior.STRIP,
  '+': ChompingBehavior.KEEP,
  '': ChompingBehavior.CLIP,
};

type InternalNodeClass = NodeClass | 'contentNode';
type InternalNodeClasses = Record<InternalNodeClass, readonly string[]>

export class AstToSerializationTree {
  nodeClasses: InternalNodeClasses;
  classForContentNode: Record<string, ContentNodeClass>;

  constructor(nodeClasses: NodeClasses) {
    this.nodeClasses = {
      ...nodeClasses,
      contentNode: CONTENT_CLASS_NAMES.flatMap(c => nodeClasses[c]),
    };

    this.classForContentNode = strictFromEntries(
      CONTENT_CLASS_NAMES
        .flatMap((className) => nodeClasses[className].map(nodeName => [nodeName as string, className]))
    );
  }

  /////

  iterateAst(nodes: readonly AstNode[], nodeClass: NodeClass) {
    return iterateAst(nodes, {
      return: this.nodeClasses[nodeClass],
      ignore: this.nodeClasses.ignore,
    });
  }

  groupNodes<const T extends Quantify<InternalNodeClass>>(nodes: readonly AstNode[], nodeClasses: readonly T[], text?: string) {
    return groupNodes(nodes, {
      return: strictFromEntries(
        nodeClasses.map(c => {
          const classes = this.nodeClasses[unquantify(c) as InternalNodeClass];
          return [c, classes];
        })
      ),
      ignore: this.nodeClasses.ignore,
    }, text);
  }

  /////

  *handleStream(text: string, node: AstNode) {
    for (const document of this.iterateAst(node.content, 'document')) {
      const { directive, nodeWithProperties } = this.groupNodes(document.content, ['directive*', 'nodeWithProperties']);
      const tagHandles = this.handleDirectives(directive.map(node => text.slice(...node.range)));

      yield this.buildNode(text, nodeWithProperties, tagHandles);
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

  buildNode(text: string, body: AstNode, tagHandles: Map<string, string>): SerializationNode {
    const {
      contentNode,
      tagProperty,
      anchorProperty,
    } = this.groupNodes([body], ['contentNode', 'tagProperty?%', 'anchorProperty?%'], text);

    const tag = tagProperty ? nodeTag(tagProperty, tagHandles) : null;
    const anchor = anchorProperty ? anchorProperty.slice(1) : null;

    return this.buildContent(text, contentNode, tagHandles, tag, anchor);
  }

  buildContent(
    text: string,
    contentNode: AstNode,
    tagHandles: Map<string, string>,
    tag: SerializationTag | null,
    anchor: string | null,
  ): SerializationNode {
    function nodeText(node: AstNode) {
      return text.slice(...node.range);
    }

    const nodeClass = this.classForContentNode[contentNode.name];
    switch (nodeClass) {
      case 'alias': return new Alias(nodeText(contentNode).slice(1));

      case 'emptyScalar': return new SerializationScalar(tag ?? NonSpecificTag.question, '', anchor);
      case 'plainScalar': {
        const content = handlePlainScalarContent(nodeText(contentNode));
        return new SerializationScalar(tag ?? NonSpecificTag.question, content, anchor);
      }
      case 'singleQuotedScalar': {
        const content = handleSingleQuotedScalarContent(nodeText(contentNode).slice(1, -1));
        return new SerializationScalar(tag ?? NonSpecificTag.exclamation, content, anchor);
      }
      case 'doubleQuotedScalar': {
        const content = handleDoubleQuotedScalarContent(nodeText(contentNode).slice(1, -1));
        return new SerializationScalar(tag ?? NonSpecificTag.exclamation, content, anchor);
      }
      case 'literalScalar': case 'foldedScalar': {
        const {
          blockScalarChompingIndicator,
          blockScalarIndentationIndicator,
          blockScalarContent,
        } = this.groupNodes(contentNode.content, [
          'blockScalarIndentationIndicator?%',
          'blockScalarChompingIndicator%',
          'blockScalarContent%'
        ], text);

        assertKeyOf(blockScalarChompingIndicator, CHOMPING_BEHAVIOR_LOOKUP, `Unexpected chomping indicator ${blockScalarChompingIndicator}`);
        const chompingBehavior = CHOMPING_BEHAVIOR_LOOKUP[blockScalarChompingIndicator];

        const content = handleBlockScalarContent(
          blockScalarContent,
          nodeClass === 'foldedScalar',
          contentNode.parameters.n as number,
          chompingBehavior,
          blockScalarIndentationIndicator === null ? null : parseDecimal(blockScalarIndentationIndicator),
        );

        return new SerializationScalar(tag ?? NonSpecificTag.exclamation, content, anchor);
      }

      case 'mapping': {
        const children = this.iterateAst([contentNode], 'mappingEntry')
          .map(child => this.iterateAst(child.content, 'nodeWithProperties'))
          .map(([k, v]) => [this.buildNode(text, k, tagHandles), this.buildNode(text, v, tagHandles)] as const);

        return new SerializationMapping(tag ?? NonSpecificTag.question, children, anchor);
      }

      case 'sequence': {
        const children = this.iterateAst(contentNode.content, 'nodeWithProperties').map(child => this.buildNode(text, child, tagHandles));
        return new SerializationSequence(tag ?? NonSpecificTag.question, children, anchor);
      }

      default: throw new TypeError(`Unexpected node ${contentNode.name}`);
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
