import { CollectionStyle, NonSpecificTag, ScalarStyle, type SerializationTag } from '@/nodes';
import { handleDoubleEscapes } from '@/parser/core/scalarContent';

import {
  getProperty, invert,
  regexp, type TypedRegExp,
} from '@/util';

const EVENT_REGEXP = regexp`
  ^
  \s*
  (?<type>\S+)
  (?:\ (?<collectionStyleIndicator>---|\.\.\.|\{\}|\[\]))?
  (?:\ &(?<anchor>.*?))?
  (?:\ <(?<tag>\S*)>)?
  (?:\ (?<styleIndicator>[:'"|>*])(?<value>.*))?
  $
` as TypedRegExp<'type' | 'collectionStyleIndicator' | 'anchor' | 'tag' | 'styleIndicator' | 'value'>;

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
  style: CollectionStyle,
};

export function parseEvent(line: string): ParseEvent {
  const match = EVENT_REGEXP.exec(line);
  EVENT_REGEXP.lastIndex = 0;
  if (match === null) throw new TypeError(`Can't match event ${JSON.stringify(line)}`);

  const { type, collectionStyleIndicator, anchor, tag, styleIndicator, value } = match.groups;

  switch (type) {
    case '+STR': return { type };
    case '-STR': return { type };
    case '+DOC': return { type };
    case '-DOC': return { type };
    case '-SEQ': return { type };
    case '-MAP': return { type };

    case '=ALI': return { type, value };
    case '=VAL': {
      const style = getProperty(SCALAR_INDICATOR_TO_STYLE, styleIndicator, `Unexpected style indicator ${JSON.stringify(styleIndicator)}`);
      return { type, tag: getTag(tag, style), anchor, style, value: handleDoubleEscapes(value) };
    }

    case '+SEQ':
    case '+MAP':
      return {
        type, tag: getTag(tag), anchor,
        style: collectionStyleIndicator ? CollectionStyle.flow : CollectionStyle.block,
      };


    default: throw new TypeError(`Unknown event type ${type}`);
  }
}

const SCALAR_INDICATOR_TO_STYLE = {
  ':': ScalarStyle.plain,
  '\'': ScalarStyle.single,
  '"': ScalarStyle.double,
  '|': ScalarStyle.block,
  '>': ScalarStyle.folded,
};

const SCALAR_STYLE_TO_INDICATOR = invert(SCALAR_INDICATOR_TO_STYLE);

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

export function stringifyEvent(event: ParseEvent) {
  const parts: string[] = [event.type];

  if (event.type === '=ALI') {
    parts.push(event.value);
  }

  if (event.type === '+SEQ' && event.style === CollectionStyle.flow) {
    parts.push('[]');
  }

  if (event.type === '+MAP' && event.style === CollectionStyle.flow) {
    parts.push('{}');
  }

  if (event.type === '=VAL' || event.type === '+SEQ' || event.type === '+MAP') {
    if (event.anchor) parts.push('&' + event.anchor);

    if (typeof event.tag === 'string') {
      parts.push('<' + event.tag + '>');
    }
  }

  if (event.type === '=VAL') {
    parts.push(SCALAR_STYLE_TO_INDICATOR[event.style] + JSON.stringify(event.value).slice(1, -1));
  }

  return parts.join(' ');
}
