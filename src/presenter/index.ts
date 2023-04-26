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

export function present(document: SerializationNode) {
  const operation = new PresentOperation();
  operation.presentDocument(document);
  return operation.result.join('');
}

const NON_PLAIN_REGEXP = regexp`
  ^[?:\-{}[\],#&*!|>'"%@\`]
  | [?:-] (?= \s | [,{}[\]] )
  | \s
`;

export function canBePlainScalar(content: string) {
  return !NON_PLAIN_REGEXP.test(content);
}

class PresentOperation {
  level = 0;
  result: string[] = [];
  needSpace = false;

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

  indent(d: number = 0) {
    this.emit(repeat(this.level + d, '  '));
  }

  presentDocument(node: SerializationNode) {
    this.emit('%YAML 1.2\n');
    this.emit('---');
    // if (node.)
    this.presentNode(node);
    this.emit('\n...\n');
  }

  presentNode(node: SerializationNode) {
    if (node.kind === 'alias') {
      this.presentAlias(node);
    } else if (node.kind === 'scalar') {
      this.presentScalar(node);
    } else if (node.kind === 'sequence') {
      this.presentSequence(node);
    } else if (node.kind === 'mapping') {
      this.presentMapping(node);
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
      this.emit('!<' + tag.toString() + '>');
    }
  }

  presentScalar(node: SerializationScalar) {
    this.presentAnchor(node.anchor);
    this.presentTag(node.tag);

    this._space();
    if (node.tag === NonSpecificTag.question) {
      if (!canBePlainScalar(node.content)) throw new TypeError(`Cannot present ${JSON.stringify(node.content)} as plain scalar`);
      this.emit(node.content);
    } else {
      this.emit(JSON.stringify(node.content));
    }
  }

  presentSequence(node: SerializationSequence) {
    this.presentAnchor(node.anchor);
    this.presentTag(node.tag);

    if (node.content.length === 0) {
      this._space();
      this.emit('[]');
    } else {
      this.level += 1;
      for (const item of node.content) {
        this.emit('\n');
        this.indent(-1);
        this.emit('-');
        this.presentNode(item);
      }
      this.level -= 1;
    }
  }

  presentMapping(node: SerializationMapping) {
    this.presentAnchor(node.anchor);
    this.presentTag(node.tag);
    
    if (node.content.length === 0) {
      this._space();
      this.emit('{}');
    } else {
      this.level += 1;
      for (const [key, value] of node.content) {
        this.emit('\n');
        this.indent(-1);
        this.emit('?');
        this.presentNode(key);

        this.emit('\n');
        this.indent(-1);
        this.emit(':');
        this.presentNode(value);
      }
      this.level -= 1;
    }
  }
}
