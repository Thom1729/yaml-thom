import {
  canBePlainScalar,
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
  assertNotUndefined, repeat, isAstral, isBmp, splitSurrogates,
  applyStrategy,
} from '@/util';

type DoubleQuoteEscapeStyle =
| 'builtin'
| 'x'
| 'u'
| 'U';

export interface PresentOptions {
  indentation?: number;
  flow?: boolean;
  scalarStyle?: readonly ScalarStyle[],
  doubleQuoteEscapeStyle?: readonly DoubleQuoteEscapeStyle[],
}

const DEFAULT_PRESENT_OPTIONS = {
  indentation: 2,
  flow: false,
  scalarStyle: [ScalarStyle.double, ScalarStyle.plain],
  doubleQuoteEscapeStyle: ['builtin', 'x', 'u', 'U'],
} satisfies Required<PresentOptions>;

export function present(document: SerializationNode, options: PresentOptions = {}) {
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

const SCALAR_STYLE_PREDICATES = {
  [ScalarStyle.plain]: (node: SerializationScalar) => canBePlainScalar(node.content),
  [ScalarStyle.single]: () => false,
  [ScalarStyle.double]: (node: SerializationScalar) => node.tag !== NonSpecificTag.question,
  [ScalarStyle.block]: () => false,
  [ScalarStyle.folded]: () => false,
};

function filter<T extends PropertyKey, U extends SerializationNode>(
  values: Iterable<T>,
  node: U,
  predicates: Record<T, (node: U) => boolean>,
) {
  for (const value of values) {
    if (predicates[value](node)) return value;
  }
  return undefined;
}

interface PresentationContext {
  level: number;
  flow: boolean;
}

class PresentOperation {
  readonly options: Required<PresentOptions>;

  constructor(options: Required<PresentOptions>) {
    this.options = options;
  }

  implicitKey(node: SerializationNode) {
    return node.kind === 'scalar';
  }

  *presentDocument(node: SerializationNode) {
    yield '%YAML 1.2\n';
    yield '---';
    yield* this.presentNode(node, { level: 0, flow: this.options.flow });
    yield '\n...\n';
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
    const style = filter(this.options.scalarStyle, node, SCALAR_STYLE_PREDICATES);

    if (style === undefined) throw new Error(`no valid scalar style for content ${JSON.stringify(node.content)}`);

    switch (style) {
      case ScalarStyle.plain : return yield* this.presentPlainScalar(node);
      case ScalarStyle.single: throw new Error(`Style ${style} not yet implemented`);
      case ScalarStyle.double: return yield* this.presentDoubleQuotedScalar(node);
      case ScalarStyle.block : throw new Error(`Style ${style} not yet implemented`);
      case ScalarStyle.folded: throw new Error(`Style ${style} not yet implemented`);
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
      const codepoint = char.codePointAt(0);
      assertNotUndefined(codepoint);
      if (mustEscapeInDoubleString(codepoint)) {
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

const DOUBLE_QUOTE_ESCAPES = new Map([
  [0x00, '0'],
  [0x07, 'a'],
  [0x08, 'b'],
  [0x09, 't'],
  [0x0a, 'n'],
  [0x0b, 'v'],
  [0x0c, 'f'],
  [0x0d, 'r'],
  [0x1b, 'e'],
  [0x20, ' '],
  [0x22, '"'],
  [0x2f, '/'],
  [0x5c, '\\'],
  [0x85, 'N'], // next line
  [0xa0, '_'], // non-breaking space
  [0x2028, 'L'], // line separator
  [0x2029, 'P'], // paragraph separator
]);

function mustEscapeInDoubleString(codepoint: number) {
  return codepoint < 0x20 || codepoint === 0x09 || codepoint === 0x5c || codepoint === 0x22;
}

const doubleQuoteEscapeStrategies = {
  builtin: (codepoint: number) => DOUBLE_QUOTE_ESCAPES.get(codepoint),
  x: (codepoint: number) => codepoint <= 0xff ? 'x' + codepoint.toString(16).padStart(2, '0') : undefined,
  u: (codepoint: number) => isBmp(codepoint) ? 'u' + codepoint.toString(16).padStart(4, '0') : undefined,
  U: (codepoint: number) => 'U' + codepoint.toString(16).padStart(8, '0'),
  surrogate: (codepoint: number) => {
    if (isAstral(codepoint)) {
      const [high, low] = splitSurrogates(codepoint);
      return `u${high.toString(16).padStart(4, '0')}\\u${low.toString(16).padStart(4, '0')}`;
    } else {
      return undefined;
    }
  },
};
