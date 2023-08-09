import { regexp, type TypedRegExp } from '@/util';

import { NonSpecificTag, type SerializationTag } from '@/nodes';
import { handleDoubleEscapes } from '@/parser/core/scalarContent';

const EVENT_REGEXP = regexp`
  ^
  \s*
  (?<type>\S+)
  (?:\ (?:---|\.\.\.|\{\}|\[\]))?
  (?:\ &(?<anchor>.*?))?
  (?:\ <(?<tag>\S*)>)?
  (?:\ (?<valueStyle>[:'"|>*])(?<value>.*))?
  $
` as TypedRegExp<'type' | 'anchor' | 'tag' | 'valueStyle' | 'value'>;

export type EventInfo =
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
  valueStyle: string,
  value: string,
}
| {
  type: '+SEQ' | '+MAP',
  anchor: string | undefined,
  tag: SerializationTag,
};

export function parseEvent(line: string): EventInfo {
  const match = EVENT_REGEXP.exec(line);
  EVENT_REGEXP.lastIndex = 0;
  if (match === null) throw new TypeError(`Can't match event ${JSON.stringify(line)}`);

  const { type, anchor, tag, valueStyle, value } = match.groups;

  switch (type) {
    case '+STR': return { type };
    case '-STR': return { type };
    case '+DOC': return { type };
    case '-DOC': return { type };

    case '=ALI': return { type, value };
    case '=VAL': return { type, tag: getTag(tag, valueStyle), anchor, valueStyle, value: handleDoubleEscapes(value) };

    case '+SEQ': return { type, tag: getTag(tag, undefined), anchor };
    case '-SEQ': return { type };

    case '+MAP': return { type, tag: getTag(tag, undefined), anchor };
    case '-MAP': return { type };

    default: throw new TypeError(`Unknown event type ${type}`);
  }
}

function getTag(
  tagString: string | undefined,
  valueStyle: string | undefined,
): SerializationTag {
  if (tagString === '!') {
    return NonSpecificTag.exclamation;
  } else if (tagString !== undefined) {
    return tagString;
  } else if (valueStyle === '\'' || valueStyle === '"' || valueStyle === '|' || valueStyle === '>') {
    return NonSpecificTag.exclamation;
  } else {
    return NonSpecificTag.question;
  }
}
