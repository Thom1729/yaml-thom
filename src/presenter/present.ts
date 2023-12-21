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
  assertNotUndefined, repeat, type CodePoint,
  applyStrategy,
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
    wrapWithSpaces(operation.presentDocument(document))
  ).join('');
}

type Tokens = Iterable<string | number | null>;

function *wrapWithSpaces(itr: Tokens) {
  let needSpace = false;
  for (const token of itr) {
    if (token === null) {
      if (needSpace) {
        yield ' ';
        needSpace = false;
      }
    } else if (typeof token === 'number') {
      if (token > 0) {
        yield repeat(token, ' ');
        needSpace = false;
      }
    } else {
      if (token.length > 0) {
        yield token;
        const lastChar = token[token.length - 1];
        needSpace = (lastChar !== ' ' && lastChar !== '\n');
      }
    }
  }
}

interface PresentationContext {
  level: number;
  flow: boolean;
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
    yield* this.presentNode(node, { level: 0, flow: this.options.flow });
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
    }
  }

  *presentTag(tag: SerializationTag, exclamationContext: boolean = false) {
    if (tag === NonSpecificTag.question) {
      if (exclamationContext) throw new Error(`Can't emit implicit question tag here`);
    } else if (tag === NonSpecificTag.exclamation) {
      if (!exclamationContext) {
        yield null;
        yield '!';
      }
    } else {
      yield null;
      yield '!<' + tag + '>';
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
    yield* this.presentAnchor(node.anchor);
    yield* this.presentTag(node.tag);

    const childContext = {
      level: context.level + this.options.indentation,
      flow: false,
    };
    for (const item of node.content) {
      yield '\n';
      yield context.level;
      yield '-';
      yield* this.presentNode(item, childContext);
    }
  }

  *presentBlockMapping(node: SerializationMapping, context: PresentationContext): Tokens {
    this.presentAnchor(node.anchor);
    yield* this.presentTag(node.tag);

    const childContext = {
      level: context.level + this.options.indentation,
      flow: false,
    };
    for (const [key, value] of node.content) {
      yield '\n';
      yield context.level;

      if (this.implicitKey(key)) {
        yield* this.presentNode(key, {
          level: context.level,
          flow: true,
        });
        yield ':';
        yield* this.presentNode(value, childContext);
      } else {
        yield '?';
        yield* this.presentNode(key, childContext);

        yield '\n';
        yield context.level;
        yield ':';
        yield* this.presentNode(value, childContext);
      }
    }
  }

  *presentFlowSequence(node: SerializationSequence, context: PresentationContext): Tokens {
    yield* this.presentAnchor(node.anchor);
    yield* this.presentTag(node.tag);

    yield null;

    const childContext = {
      level: context.level + this.options.indentation,
      flow: true,
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

  *presentFlowMapping(node: SerializationMapping, context: PresentationContext): Tokens {
    yield* this.presentAnchor(node.anchor);
    yield* this.presentTag(node.tag);
    
    yield null;
    if (node.content.length === 0) {
      yield '{}';
    } else {
      yield '{';

      const childContext = {
        level: context.level + this.options.indentation,
        flow: true,
      };
      for (const [key, value] of node.content) {
        if (this.implicitKey(key)) {
          yield '\n';
          yield context.level + this.options.indentation;
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
