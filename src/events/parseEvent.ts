// const EVENT_REGEXP = new RegExp(
//   [
//     /^\s*/,
//     /(?<type>\S+)/,
//     /(?: (?:---|\.\.\.|\{\}|\[\]))?/,
//     /(?: &(?<anchor>.*?))?/,
//     /(?: <(?<tag>\S*)>)?/,
//     /(?: (?<valueStyle>[:'"|>*])(?<value>.*))?$/u,
//   ].map(r => r.source).join(''),
//   'u',
// );

import { regexp } from '@/util';

const EVENT_REGEXP = regexp`
  ^
  \s*
  (?<type>\S+)
  (?:\ (?:---|\.\.\.|\{\}|\[\]))?
  (?:\ &(?<anchor>.*?))?
  (?:\ <(?<tag>\S*)>)?
  (?:\ (?<valueStyle>[:'"|>*])(?<value>.*))?
  $
`;

export type EventInfo = {
  type: string,
  anchor?: string,
  tag?: string,
  valueStyle?: string,
  value?: string,
};

export function parseEvent(line: string): EventInfo {
  const match = EVENT_REGEXP.exec(line);
  EVENT_REGEXP.lastIndex = 0;
  if (match === null) throw new TypeError(`Can't match event ${line}`);
  return match.groups as EventInfo;
}
