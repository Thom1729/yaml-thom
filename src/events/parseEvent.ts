import { regexp, type TypedRegExp } from '@/util';

import { NonSpecificTag, ScalarStyle, type SerializationTag } from '@/nodes';
import { handleDoubleEscapes } from '@/parser/core/scalarContent';

const EVENT_REGEXP = regexp`
  ^
  \s*
  (?<type>\S+)
  (?:\ (?:---|\.\.\.|\{\}|\[\]))?
  (?:\ &(?<anchor>.*?))?
  (?:\ <(?<tag>\S*)>)?
  (?:\ (?<styleIndicator>[:'"|>*])(?<value>.*))?
  $
` as TypedRegExp<'type' | 'anchor' | 'tag' | 'styleIndicator' | 'value'>;

export type ParseEvent =
| {
  type: '+STR' | '-STR' | '+DOC' | '-DOC' | '-SEQ' | '-MAP',
}
| {
  type: '=ALI',
  value: string,
}
| {
  type: '=VAL',
  anchor: string | undefined,
  tag: SerializationTag,
  style: ScalarStyle,
  value: string,
}
| {
  type: '+SEQ' | '+MAP',
  anchor: string | undefined,
  tag: SerializationTag,
};

export function parseEvent(line: string): ParseEvent {
  const match = EVENT_REGEXP.exec(line);
  EVENT_REGEXP.lastIndex = 0;
  if (match === null) throw new TypeError(`Can't match event ${JSON.stringify(line)}`);

  const { type, anchor, tag, styleIndicator, value } = match.groups;

  switch (type) {
    case '+STR': return { type };
    case '-STR': return { type };
    case '+DOC': return { type };
    case '-DOC': return { type };

    case '=ALI': return { type, value };
    case '=VAL': {
      const style = getStyle(styleIndicator);
      return { type, tag: getTag(tag, style), anchor, style, value: handleDoubleEscapes(value) };
    }

    case '+SEQ': return { type, tag: getTag(tag), anchor };
    case '-SEQ': return { type };

    case '+MAP': return { type, tag: getTag(tag), anchor };
    case '-MAP': return { type };

    default: throw new TypeError(`Unknown event type ${type}`);
  }
}

function getStyle(styleIndicator: string) {
  switch (styleIndicator) {
    case ':': return ScalarStyle.plain;
    case '\'': return ScalarStyle.single;
    case '"': return ScalarStyle.double;
    case '|': return ScalarStyle.block;
    case '>': return ScalarStyle.folded;

    default: throw new TypeError(`Unexpected style indicator ${JSON.stringify(styleIndicator)}`);
  }
}

function getTag(
  tagString: string | undefined,
  scalarStyle?: ScalarStyle,
): SerializationTag {
  if (tagString === '!') {
    return NonSpecificTag.exclamation;
  } else if (tagString !== undefined) {
    return tagString;
  } else if (scalarStyle === undefined || scalarStyle === ScalarStyle.plain) {
    return NonSpecificTag.question;
  } else {
    return NonSpecificTag.exclamation;
  }
}
