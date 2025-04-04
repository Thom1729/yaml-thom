import {
  NonSpecificTag,
  ScalarStyle,

  type SerializationNode,
  type Alias,
  type SerializationScalar,
  type SerializationSequence,
  type SerializationMapping,
  type SerializationTag,
} from '@/nodes';

import {
  assertNotUndefined, type CodePoint,
  applyStrategy,
  stringifyTokens, type Tokens,
} from '@/util';

import { isDoubleSafe, canBePlainScalar } from '@/scalar';

import {
  DEFAULT_PRESENT_OPTIONS, type PresentOptions,
  scalarStyleStrategies, doubleQuoteEscapeCharacters, doubleQuoteEscapeStrategies,
} from './presentOptions';

export function present(document: SerializationNode, options: Partial<PresentOptions> = {}) {
  const computedOptions = {
    ...DEFAULT_PRESENT_OPTIONS,
    ...options,
  };
  const operation = new PresentOperation(computedOptions);
  return Array.from(
    stringifyTokens(operation.presentDocument(document))
  ).join('');
}

interface PresentationContext {
  level: number;
  flow: boolean;
  compactable: boolean;
}

class PresentOperation {
  readonly options: PresentOptions;

  constructor(options: PresentOptions) {
    this.options = options;
  }

  implicitKey(node: SerializationNode) {
    return node.kind === 'scalar';
  }

  *presentDocument(node: SerializationNode) {
    const atLeastOneDirective = yield* this.presentDirectives();
    if (atLeastOneDirective || this.options.startMarker) {
      yield '---';
    }
    const context: PresentationContext = {
      level: 0,
      flow: this.options.flow,
      compactable: false,
    };
    yield* this.presentNode(node, context);
    if (this.options.endMarker) {
      yield '\n...';
    }
    if (this.options.trailingNewline) {
      yield '\n';
    }
  }

  *presentDirectives() {
    let atLeastOne = false;
    if (this.options.versionDirective) {
      atLeastOne = true;
      yield '%YAML 1.2\n';
    }
    for (const [handle, prefix] of this.options.tagShorthands) {
      atLeastOne = true;
      // TODO check that handle is valid
      yield `%TAG ${handle} ${prefix}\n`;
    }
    return atLeastOne;
  }

  *presentNode(node: SerializationNode, context: PresentationContext) {
    if (node.kind === 'alias') {
      yield* this.presentAlias(node);
    } else if (node.kind === 'scalar') {
      yield* this.presentScalar(node);
    } else if (node.kind === 'sequence') {
      yield* this.presentSequence(node, context);
    } else if (node.kind === 'mapping') {
      yield* this.presentMapping(node, context);
    }
  }

  *presentAlias(node: Alias) {
    yield null;
    yield '*' + node.alias;
  }

  *presentAnchor(anchor: string | null) {
    if (anchor !== null) {
      yield null;
      yield '&' + anchor;
      return true;
    }
    return false;
  }

  *presentTag(tag: SerializationTag, exclamationContext: boolean = false) {
    if (tag === NonSpecificTag.question) {
      if (exclamationContext) throw new Error(`Can't emit implicit question tag here`);
    } else if (tag === NonSpecificTag.exclamation) {
      if (!exclamationContext) {
        yield null;
        yield '!';
        return true;
      }
    } else {
      const shorthand = this.findTagShorthand(tag);
      if (shorthand !== undefined) {
        yield null;
        yield shorthand;
        return true;
      } else {
        yield null;
        yield '!<' + tag + '>';
        return true;
      }
    }
    return false;
  }

  findTagShorthand(tag: string) {
    for (const [handle, prefix] of this.options.tagShorthands) {
      if (tag.startsWith(prefix)) return handle + tag.slice(prefix.length);
    }

    if (this.options.useDefaultTagShorthands) {
      for (const [handle, prefix] of DEFAULT_TAG_HANDLES) {
        if (tag.startsWith(prefix)) return handle + tag.slice(prefix.length);
      }
    }
  }

  *presentScalar(node: SerializationScalar) {
    const style = applyStrategy(scalarStyleStrategies, this.options.scalarStyle, [node]);

    if (style === undefined) throw new Error(`no valid scalar style for content ${JSON.stringify(node.content)}`);

    switch (style) {
      case ScalarStyle.plain : return yield* this.presentPlainScalar(node);
      // case ScalarStyle.single: throw new Error(`Style ${style} not yet implemented`);
      case ScalarStyle.double: return yield* this.presentDoubleQuotedScalar(node);
      // case ScalarStyle.block : throw new Error(`Style ${style} not yet implemented`);
      // case ScalarStyle.folded: throw new Error(`Style ${style} not yet implemented`);
    }
  }

  *presentPlainScalar(node: SerializationScalar) {
    if (!canBePlainScalar(node.content)) throw new TypeError(`Cannot present ${JSON.stringify(node.content)} as plain scalar`);

    yield* this.presentAnchor(node.anchor);
    yield* this.presentTag(node.tag);

    yield null;
    yield node.content;
  }

  *presentDoubleQuotedScalar(node: SerializationScalar) {
    yield* this.presentAnchor(node.anchor);
    yield* this.presentTag(node.tag, true);

    yield null;
    yield '"';
    for (const char of node.content) {
      const codepoint = char.codePointAt(0) as CodePoint | undefined;
      assertNotUndefined(codepoint);

      const shouldEscape = (
        !isDoubleSafe(codepoint) ||
        applyStrategy(doubleQuoteEscapeCharacters, this.options.doubleQuoteEscapeCharacters, [codepoint])
      );

      if (shouldEscape) {
        const result = applyStrategy(doubleQuoteEscapeStrategies, this.options.doubleQuoteEscapeStyle, [codepoint]);
        assertNotUndefined(result);
        yield '\\' + result;
      } else {
        yield char;
      }
    }
    yield '"';
  }

  *presentSequence(node: SerializationSequence, context: PresentationContext): Tokens {
    if (context.flow || node.size === 0) {
      yield* this.presentFlowSequence(node, context);
    } else {
      yield* this.presentBlockSequence(node, context);
    }
  }

  *presentBlockSequence(node: SerializationSequence, context: PresentationContext): Tokens {
    const hasAnchor = yield* this.presentAnchor(node.anchor);
    const hasTag = yield* this.presentTag(node.tag);

    let compact = this.options.compact && context.compactable && !hasAnchor && !hasTag;

    const childContext: PresentationContext = {
      level: context.level + this.options.indentation,
      flow: false,
      compactable: true,
    };

    for (const item of node.content) {
      if (compact) {
        yield null;
        compact = false;
      } else {
        yield '\n';
        yield context.level;
      }
      yield '-';
      yield* this.presentNode(item, childContext);
    }
  }

  *presentFlowSequence(node: SerializationSequence, context: PresentationContext): Tokens {
    yield* this.presentAnchor(node.anchor);
    yield* this.presentTag(node.tag);

    yield null;

    const childContext: PresentationContext = {
      level: context.level + this.options.indentation,
      flow: true,
      compactable: false,
    };

    if (node.content.length === 0) {
      yield '[]';
    } else {
      yield '[';

      for (const item of node.content) {
        yield '\n';
        yield childContext.level;
        yield* this.presentNode(item, childContext);
        yield ',';
      }

      yield '\n';
      yield context.level;
      yield ']';
    }
  }

  *presentMapping(node: SerializationMapping, context: PresentationContext): Tokens {
    if (context.flow || node.size === 0) {
      yield* this.presentFlowMapping(node, context);
    } else {
      yield* this.presentBlockMapping(node, context);
    }
  }

  *presentBlockMapping(node: SerializationMapping, context: PresentationContext): Tokens {
    const hasAnchor = yield* this.presentAnchor(node.anchor);
    const hasTag = yield* this.presentTag(node.tag);

    let compact = this.options.compact && context.compactable && !hasAnchor && !hasTag;

    const explicitChildContext: PresentationContext = {
      level: context.level + this.options.indentation,
      flow: false,
      compactable: true,
    };

    const implicitChildContext: PresentationContext = {
      level: context.level + this.options.indentation,
      flow: false,
      compactable: false,
    };

    for (const [key, value] of node.content) {
      if (compact) {
        yield null;
        compact = false;
      } else {
        yield '\n';
        yield context.level;
      }

      if (this.implicitKey(key)) {
        yield* this.presentNode(key, {
          level: context.level,
          flow: true,
          compactable: false,
        });
        yield ':';
        yield* this.presentNode(value, implicitChildContext);
      } else {
        yield '?';
        yield* this.presentNode(key, explicitChildContext);

        yield '\n';
        yield context.level;
        yield ':';
        yield* this.presentNode(value, explicitChildContext);
      }
    }
  }

  *presentFlowMapping(node: SerializationMapping, context: PresentationContext): Tokens {
    yield* this.presentAnchor(node.anchor);
    yield* this.presentTag(node.tag);
    
    yield null;
    if (node.content.length === 0) {
      yield '{}';
    } else {
      yield '{';

      const childContext: PresentationContext = {
        level: context.level + this.options.indentation,
        flow: true,
        compactable: false,
      };

      for (const [key, value] of node.content) {
        if (this.implicitKey(key)) {
          yield '\n';
          yield childContext.level;
          yield* this.presentNode(key, childContext);

          yield ':';
          yield* this.presentNode(value, childContext);
        } else {
          yield '\n';
          yield childContext.level;
          yield '?';
          yield* this.presentNode(key, childContext);

          yield '\n';
          yield childContext.level;
          yield ':';
          yield* this.presentNode(value, childContext);
        }
      }

      yield '\n';
      yield context.level;
      yield '}';
    }
  }
}

const DEFAULT_TAG_HANDLES = new Map([
  ['!', '!'],
  ['!!', 'tag:yaml.org,2002:'],
]);
