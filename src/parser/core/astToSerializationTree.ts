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

import { iterateAst, groupNodes, unquantify, Quantify } from '../core/transformAst';

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
| 'ignore'

| 'contentNode';

const YAML_VERSION_EXPR = /^(\d+)\.(\d+)$/;
const TAG_HANDLE_EXPR = /^!([-A-Za-z0-9]*!)?$/;
const TAG_PREFIX_EXPR = /^(?:[-A-Za-z0-9#;/?:@&=+$_.!~*'()]|%\p{Hex_Digit}{2})(?:[-A-Za-z0-9#;/?:@&=+$,_.!~*'()[\]]|%\p{Hex_Digit}{2})*$/u;

const DEFAULT_TAG_HANDLES = {
  '!': '!',
  '!!': 'tag:yaml.org,2002:',
} as Partial<Record<string, string>>;

const CHOMPING_BEHAVIOR_LOOKUP = {
  '-': ChompingBehavior.STRIP,
  '+': ChompingBehavior.KEEP,
  '': ChompingBehavior.CLIP,
};

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

export class AstToSerializationTree {
  nodeClasses: Record<NodeClass, readonly string[]>;
  classForContentNode: Record<string, ContentNodeClass>;

  constructor(nodeClasses: Record<Exclude<NodeClass, 'contentNode'>, readonly string[]>) {
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

  groupNodes<const T extends Quantify<NodeClass>>(nodes: readonly AstNode[], nodeClasses: readonly T[], text?: string) {
    return groupNodes(nodes, {
      return: strictFromEntries(
        nodeClasses.map(c => {
          const classes = this.nodeClasses[unquantify(c) as NodeClass];
          return [c, classes];
        })
      ),
      ignore: this.nodeClasses.ignore,
    }, text);
  }

  /////

  *handleStream(text: string, node: AstNode) {
    for (const { directives, body } of this.splitStream(node)) {
      const tagHandles = this.handleDirectives(directives.map(node => text.slice(...node.range)));

      yield this.buildDocument(text, body, tagHandles);
    }
  }

  *splitStream(node: AstNode) {
    const nodeStream = this.iterateAst(node.content, 'document');

    for (const node of nodeStream) {
      const b = this.groupNodes(node.content, ['directive*', 'nodeWithProperties']);

      yield { directives: b.directive, body: b.nodeWithProperties };
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

  buildDocument(text: string, body: AstNode, tagHandles: Map<string, string>): SerializationNode {
    function nodeText(node: AstNode) {
      return text.slice(...node.range);
    }

    const {
      contentNode,
      tagProperty,
      anchorProperty,
    } = this.groupNodes([body], ['contentNode', 'tagProperty?%', 'anchorProperty?%'], text);

    const tag = tagProperty ? nodeTag(tagProperty, tagHandles) : null;
    const anchor = anchorProperty ? anchorProperty.slice(1) : null;

    switch (this.classForContentNode[contentNode.name]) {
      case 'alias': return new Alias(nodeText(contentNode).slice(1));

      case 'emptyScalar': return new SerializationScalar(tag ?? NonSpecificTag.question, '', anchor);
      case 'plainScalar': return new SerializationScalar(tag ?? NonSpecificTag.question, handlePlainScalarContent(nodeText(contentNode)), anchor);
      case 'singleQuotedScalar': return new SerializationScalar(tag ?? NonSpecificTag.exclamation, handleSingleQuotedScalarContent(nodeText(contentNode).slice(1, -1)), anchor);
      case 'doubleQuotedScalar': return new SerializationScalar(tag ?? NonSpecificTag.exclamation, handleDoubleQuotedScalarContent(nodeText(contentNode).slice(1, -1)), anchor);

      case 'literalScalar':
        return new SerializationScalar(tag ?? NonSpecificTag.exclamation, this.blockScalarContent(text, contentNode, false), anchor);
      case 'foldedScalar':
        return new SerializationScalar(tag ?? NonSpecificTag.exclamation, this.blockScalarContent(text, contentNode, true), anchor);

      case 'mapping': {
        const children = this.iterateAst([contentNode], 'mappingEntry')
          .map(child => {
            const kv = this.iterateAst(child.content, 'nodeWithProperties');

            if (kv.length !== 2) throw new Error(kv.toString());

            return kv as [AstNode, AstNode];
          })
          .map(([k, v]) => [this.buildDocument(text, k, tagHandles), this.buildDocument(text, v, tagHandles)] as const);

        return new SerializationMapping(tag ?? NonSpecificTag.question, children, anchor);
      }

      case 'sequence': {
        const children = this.iterateAst(contentNode.content, 'nodeWithProperties').map(child => this.buildDocument(text, child, tagHandles));
        return new SerializationSequence(tag ?? NonSpecificTag.question, children, anchor);
      }

      default: throw new TypeError(`Unexpected node ${contentNode.name}`);
    }
  }

  blockScalarContent(text: string, node: AstNode, folded: boolean) {
    const {
      blockScalarChompingIndicator,
      blockScalarIndentationIndicator,
      blockScalarContent,
    } = this.groupNodes(node.content, [
      'blockScalarIndentationIndicator?%',
      'blockScalarChompingIndicator%',
      'blockScalarContent%'
    ], text);

    assertKeyOf(blockScalarChompingIndicator, CHOMPING_BEHAVIOR_LOOKUP, `Unexpected chomping indicator ${blockScalarChompingIndicator}`);
    const chompingBehavior = CHOMPING_BEHAVIOR_LOOKUP[blockScalarChompingIndicator];

    return handleBlockScalarContent(
      blockScalarContent,
      folded,
      node.parameters.n as number,
      chompingBehavior,
      blockScalarIndentationIndicator === null ? null : parseDecimal(blockScalarIndentationIndicator),
    );
  }
}
