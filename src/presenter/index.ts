import {
  type SerializationNode,
  type Alias,
  type SerializationScalar,
  type SerializationSequence,
  type SerializationMapping,
  type SerializationTag,
  NonSpecificTag,
} from '@/nodes';

import { repeat, regexp } from '@/util';

export interface PresentOptions {
  indentation?: number;
  flow?: boolean;
}

const DEFAULT_PRESENT_OPTIONS = {
  indentation: 2,
  flow: false,
} satisfies PresentOptions;

export function present(document: SerializationNode, options: PresentOptions = {}) {
  const operation = new PresentOperation(options);
  operation.presentDocument(document);
  return operation.result.join('');
}

class PresentOperation {
  indentation: number;
  flow: boolean;

  result: string[] = [];
  needSpace = false;

  constructor(options: PresentOptions) {
    this.indentation = options.indentation ?? DEFAULT_PRESENT_OPTIONS.indentation;
    this.flow = options.flow ?? DEFAULT_PRESENT_OPTIONS.flow;
  }

  emit(s: string) {
    if (s.length > 0) {
      this.result.push(s);
      const last = s[s.length - 1];
      this.needSpace = last !== '\n' && last !== ' ';
    }
  }

  _space() {
    if (this.needSpace) {
      this.emit(' ');
    }
  }

  indent(level: number) {
    this.emit(repeat(level, ' '));
  }

  implicitKey(node: SerializationNode) {
    return node.kind === 'scalar';
  }

  presentDocument(node: SerializationNode) {
    this.emit('%YAML 1.2\n');
    this.emit('---');
    this.presentNode(node, 0, this.flow);
    this.emit('\n...\n');
  }

  presentNode(node: SerializationNode, level: number, flow: boolean) {
    if (node.kind === 'alias') {
      this.presentAlias(node);
    } else if (node.kind === 'scalar') {
      this.presentScalar(node);
    } else if (node.kind === 'sequence') {
      if (flow || node.size === 0) {
        this.presentFlowSequence(node, level);
      } else {
        this.presentBlockSequence(node, level);
      }
    } else if (node.kind === 'mapping') {
      if (flow || node.size === 0) {
        this.presentFlowMapping(node, level);
      } else {
        this.presentBlockMapping(node, level);
      }
    }
  }

  presentAlias(node: Alias) {
    this._space();
    this.emit('*' + node.alias);
  }

  presentAnchor(anchor: string | null) {
    if (anchor !== null) {
      this._space();
      this.emit('&' + anchor);
    }
  }

  presentTag(tag: SerializationTag) {
    if (tag === NonSpecificTag.question) {
      // pass
    } else if (tag === NonSpecificTag.exclamation) {
      this._space();
      this.emit('!');
    } else {
      this._space();
      this.emit('!<' + tag + '>');
    }
  }

  presentScalar(node: SerializationScalar) {
    this.presentAnchor(node.anchor);
    this.presentTag(node.tag);

    this._space();
    if (node.tag === NonSpecificTag.question) {
      this.presentPlainScalar(node);
    } else {
      this.presentDoubleQuotedScalar(node);
    }
  }

  presentPlainScalar(node: SerializationScalar) {
    if (!canBePlainScalar(node.content)) throw new TypeError(`Cannot present ${JSON.stringify(node.content)} as plain scalar`);
    this.emit(node.content);
  }

  presentDoubleQuotedScalar(node: SerializationScalar) {
    this.emit(JSON.stringify(node.content));
  }

  presentBlockSequence(node: SerializationSequence, level: number) {
    this.presentAnchor(node.anchor);
    this.presentTag(node.tag);

    for (const item of node.content) {
      this.emit('\n');
      this.indent(level);
      this.emit('-');
      this.presentNode(item, level + this.indentation, false);
    }
  }

  presentBlockMapping(node: SerializationMapping, level: number) {
    this.presentAnchor(node.anchor);
    this.presentTag(node.tag);

    for (const [key, value] of node.content) {
      this.emit('\n');
      this.indent(level);

      if (this.implicitKey(key)) {
        this.presentNode(key, level, true);
        this.emit(':');
        this.presentNode(value, level + this.indentation, false);
      } else {
        this.emit('?');
        this.presentNode(key, level + this.indentation, false);

        this.emit('\n');
        this.indent(level);
        this.emit(':');
        this.presentNode(value, level + this.indentation, false);
      }
    }
  }

  presentFlowSequence(node: SerializationSequence, level: number) {
    this.presentAnchor(node.anchor);
    this.presentTag(node.tag);

    this._space();
    if (node.content.length === 0) {
      this.emit('[]');
    } else {
      this.emit('[');

      for (const item of node.content) {
        this.emit('\n');
        this.indent(level + this.indentation);
        this.presentNode(item, level + this.indentation, true);
        this.emit(',');
      }

      this.emit('\n');
      this.indent(level);
      this.emit(']');
    }
  }

  presentFlowMapping(node: SerializationMapping, level: number) {
    this.presentAnchor(node.anchor);
    this.presentTag(node.tag);
    
    this._space();
    if (node.content.length === 0) {
      this.emit('{}');
    } else {
      this.emit('{');

      for (const [key, value] of node.content) {
        if (this.implicitKey(key)) {
          this.emit('\n');
          this.indent(level + this.indentation);
          this.presentNode(key, level + this.indentation, true);

          this.emit(':');
          this.presentNode(value, level + this.indentation, true);
        } else {
          this.emit('\n');
          this.indent(level + this.indentation);
          this.emit('?');
          this.presentNode(key, level + this.indentation, true);

          this.emit('\n');
          this.indent(level + this.indentation);
          this.emit(':');
          this.presentNode(value, level + this.indentation, true);
        }
      }

      this.emit('\n');
      this.indent(level);
      this.emit('}');
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
