import { regexp, type TypedRegExp } from '@/util';

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
  anchor?: string,
  tag?: string,
  valueStyle?: string,
  value: string,
}
| {
  type: '+SEQ' | '+MAP',
  anchor?: string,
  tag?: string,
};

export function parseEvent(line: string): EventInfo {
  const match = EVENT_REGEXP.exec(line);
  EVENT_REGEXP.lastIndex = 0;
  if (match === null) throw new TypeError(`Can't match event ${line}`);

  const { type, anchor, tag, valueStyle, value } = match.groups;

  switch (type) {
    case '+STR': return { type };
    case '-STR': return { type };
    case '+DOC': return { type };
    case '-DOC': return { type };

    case '=ALI': return { type, value };
    case '=VAL': return { type, tag, anchor, valueStyle, value };

    case '+SEQ': return { type, tag, anchor };
    case '-SEQ': return { type };

    case '+MAP': return { type, tag, anchor };
    case '-MAP': return { type };

    default: throw new TypeError(`Unknown event type ${type}`);
  }
}
