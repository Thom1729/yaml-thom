import {
  type SerializationNode,
  type Alias,
  type SerializationScalar,
  type SerializationSequence,
  type SerializationMapping,
  type SerializationTag,

  NonSpecificTag,
  ScalarStyle,
} from '@/nodes';

import { repeat, regexp } from '@/util';

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
  return Array.from(operation.presentDocument(document)).join('');
}

const SCALAR_STYLE_PREDICATES = {
  [ScalarStyle.plain]: (node: SerializationScalar) => canBePlainScalar(node.content),
  [ScalarStyle.single]: (node: SerializationScalar) => false,
  [ScalarStyle.double]: (node: SerializationScalar) => node.tag !== NonSpecificTag.question,
  [ScalarStyle.block]: (node: SerializationScalar) => false,
  [ScalarStyle.folded]: (node: SerializationScalar) => false,
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
  private needSpace = false;

  constructor(options: Required<PresentOptions>) {
    this.options = options;
  }

  *emit(s: string) {
    if (s.length > 0) {
      yield s;
      const last = s[s.length - 1];
      this.needSpace = last !== '\n' && last !== ' ';
    }
  }

  *_space() {
    if (this.needSpace) {
      yield* this.emit(' ');
    }
  }

  *indent(level: number) {
    yield* this.emit(repeat(level, ' '));
  }

  implicitKey(node: SerializationNode) {
    return node.kind === 'scalar';
  }

  *presentDocument(node: SerializationNode) {
    yield* this.emit('%YAML 1.2\n');
    yield* this.emit('---');
    yield* this.presentNode(node, 0, this.options.flow);
    yield* this.emit('\n...\n');
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
    yield* this._space();
    yield* this.emit('*' + node.alias);
  }

  *presentAnchor(anchor: string | null) {
    if (anchor !== null) {
      yield* this._space();
      yield* this.emit('&' + anchor);
    }
  }

  *presentTag(tag: SerializationTag) {
    if (tag === NonSpecificTag.question) {
      // pass
    } else if (tag === NonSpecificTag.exclamation) {
      yield* this._space();
      yield* this.emit('!');
    } else {
      yield* this._space();
      yield* this.emit('!<' + tag + '>');
    }
  }

  *presentScalar(node: SerializationScalar) {
    yield* this.presentAnchor(node.anchor);
    yield* this.presentTag(node.tag);

    yield* this._space();

    const style = filter(this.options.scalarStyle, node, SCALAR_STYLE_PREDICATES);

    if (style === undefined) throw new Error(`no valid scalar style`);

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
    yield* this.emit(node.content);
  }

  *presentDoubleQuotedScalar(node: SerializationScalar) {
    yield* this.emit(JSON.stringify(node.content));
  }

  *presentSequence(node: SerializationSequence, level: number, flow: boolean): Generator<string> {
    if (flow || node.size === 0) {
      yield* this.presentFlowSequence(node, level);
    } else {
      yield* this.presentBlockSequence(node, level);
    }
  }

  *presentBlockSequence(node: SerializationSequence, level: number): Generator<string> {
    yield* this.presentAnchor(node.anchor);
    yield* this.presentTag(node.tag);

    for (const item of node.content) {
      yield* this.emit('\n');
      yield* this.indent(level);
      yield* this.emit('-');
      yield* this.presentNode(item, level + this.options.indentation, false);
    }
  }

  *presentBlockMapping(node: SerializationMapping, level: number): Generator<string> {
    this.presentAnchor(node.anchor);
    yield* this.presentTag(node.tag);

    for (const [key, value] of node.content) {
      yield* this.emit('\n');
      yield* this.indent(level);

      if (this.implicitKey(key)) {
        yield* this.presentNode(key, level, true);
        yield* this.emit(':');
        yield* this.presentNode(value, level + this.options.indentation, false);
      } else {
        yield* this.emit('?');
        yield* this.presentNode(key, level + this.options.indentation, false);

        yield* this.emit('\n');
        yield* this.indent(level);
        yield* this.emit(':');
        yield* this.presentNode(value, level + this.options.indentation, false);
      }
    }
  }

  *presentFlowSequence(node: SerializationSequence, level: number): Generator<string> {
    yield* this.presentAnchor(node.anchor);
    yield* this.presentTag(node.tag);

    yield* this._space();
    if (node.content.length === 0) {
      yield* this.emit('[]');
    } else {
      yield* this.emit('[');

      for (const item of node.content) {
        yield* this.emit('\n');
        yield* this.indent(level + this.options.indentation);
        yield* this.presentNode(item, level + this.options.indentation, true);
        yield* this.emit(',');
      }

      yield* this.emit('\n');
      yield* this.indent(level);
      yield* this.emit(']');
    }
  }

  *presentMapping(node: SerializationMapping, level: number, flow: boolean): Generator<string> {
    if (flow || node.size === 0) {
      yield* this.presentFlowMapping(node, level);
    } else {
      yield* this.presentBlockMapping(node, level);
    }
  }

  *presentFlowMapping(node: SerializationMapping, level: number): Generator<string> {
    yield* this.presentAnchor(node.anchor);
    yield* this.presentTag(node.tag);
    
    yield* this._space();
    if (node.content.length === 0) {
      yield* this.emit('{}');
    } else {
      yield* this.emit('{');

      for (const [key, value] of node.content) {
        if (this.implicitKey(key)) {
          yield* this.emit('\n');
          yield* this.indent(level + this.options.indentation);
          yield* this.presentNode(key, level + this.options.indentation, true);

          yield* this.emit(':');
          yield* this.presentNode(value, level + this.options.indentation, true);
        } else {
          yield* this.emit('\n');
          yield* this.indent(level + this.options.indentation);
          yield* this.emit('?');
          yield* this.presentNode(key, level + this.options.indentation, true);

          yield* this.emit('\n');
          yield* this.indent(level + this.options.indentation);
          yield* this.emit(':');
          yield* this.presentNode(value, level + this.options.indentation, true);
        }
      }

      yield* this.emit('\n');
      yield* this.indent(level);
      yield* this.emit('}');
    }
  }
}

const NON_PLAIN_REGEXP = regexp`
  ^[?:\-{}[\],#&*!|>'"%@\`]
  | [?:-] (?= \s | [,{}[\]] )
  | \s
`;

export function canBePlainScalar(content: string) {
  return !NON_PLAIN_REGEXP.test(content);
}
