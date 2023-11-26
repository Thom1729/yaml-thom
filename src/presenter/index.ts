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

import { repeat } from '@/util';

export interface PresentOptions {
  indentation?: number;
  flow?: boolean;
  scalarStyle?: ScalarStyle[],
}

const DEFAULT_PRESENT_OPTIONS = {
  indentation: 2,
  flow: false,
  scalarStyle: [ScalarStyle.double, ScalarStyle.plain],
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
    yield* this.presentNode(node, 0, this.options.flow);
    yield '\n...\n';
  }

  *presentNode(node: SerializationNode, level: number, flow: boolean) {
    if (node.kind === 'alias') {
      yield* this.presentAlias(node);
    } else if (node.kind === 'scalar') {
      yield* this.presentScalar(node);
    } else if (node.kind === 'sequence') {
      yield* this.presentSequence(node, level, flow);
    } else if (node.kind === 'mapping') {
      yield* this.presentMapping(node, level, flow);
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
    yield* this.presentAnchor(node.anchor);

    yield null;

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

    yield* this.presentTag(node.tag);
    yield node.content;
  }

  *presentDoubleQuotedScalar(node: SerializationScalar) {
    yield* this.presentTag(node.tag, true);
    yield JSON.stringify(node.content);
  }

  *presentSequence(node: SerializationSequence, level: number, flow: boolean): Tokens {
    if (flow || node.size === 0) {
      yield* this.presentFlowSequence(node, level);
    } else {
      yield* this.presentBlockSequence(node, level);
    }
  }

  *presentBlockSequence(node: SerializationSequence, level: number): Tokens {
    yield* this.presentAnchor(node.anchor);
    yield* this.presentTag(node.tag);

    for (const item of node.content) {
      yield '\n';
      yield level;
      yield '-';
      yield* this.presentNode(item, level + this.options.indentation, false);
    }
  }

  *presentBlockMapping(node: SerializationMapping, level: number): Tokens {
    this.presentAnchor(node.anchor);
    yield* this.presentTag(node.tag);

    const childLevel = level + this.options.indentation;
    for (const [key, value] of node.content) {
      yield '\n';
      yield level;

      if (this.implicitKey(key)) {
        yield* this.presentNode(key, level, true);
        yield ':';
        yield* this.presentNode(value, childLevel, false);
      } else {
        yield '?';
        yield* this.presentNode(key, childLevel, false);

        yield '\n';
        yield level;
        yield ':';
        yield* this.presentNode(value, childLevel, false);
      }
    }
  }

  *presentFlowSequence(node: SerializationSequence, level: number): Tokens {
    yield* this.presentAnchor(node.anchor);
    yield* this.presentTag(node.tag);

    yield null;

    const childLevel = level + this.options.indentation;
    if (node.content.length === 0) {
      yield '[]';
    } else {
      yield '[';

      for (const item of node.content) {
        yield '\n';
        yield childLevel;
        yield* this.presentNode(item, childLevel, true);
        yield ',';
      }

      yield '\n';
      yield level;
      yield ']';
    }
  }

  *presentMapping(node: SerializationMapping, level: number, flow: boolean): Tokens {
    if (flow || node.size === 0) {
      yield* this.presentFlowMapping(node, level);
    } else {
      yield* this.presentBlockMapping(node, level);
    }
  }

  *presentFlowMapping(node: SerializationMapping, level: number): Tokens {
    yield* this.presentAnchor(node.anchor);
    yield* this.presentTag(node.tag);
    
    yield null;
    if (node.content.length === 0) {
      yield '{}';
    } else {
      yield '{';

      const childLevel = level + this.options.indentation;
      for (const [key, value] of node.content) {
        if (this.implicitKey(key)) {
          yield '\n';
          yield level + this.options.indentation;
          yield* this.presentNode(key, childLevel, true);

          yield ':';
          yield* this.presentNode(value, childLevel, true);
        } else {
          yield '\n';
          yield childLevel;
          yield '?';
          yield* this.presentNode(key, childLevel, true);

          yield '\n';
          yield childLevel;
          yield ':';
          yield* this.presentNode(value, childLevel, true);
        }
      }

      yield '\n';
      yield level;
      yield '}';
    }
  }
}
