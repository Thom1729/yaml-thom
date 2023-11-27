import { regexp } from '@/util';

export enum ScalarStyle {
  plain = 'plain',
  single = 'single',
  double = 'double',
  block = 'block',
  folded = 'folded',
}

export enum CollectionStyle {
  block = 'block',
  flow = 'flow',
}

const NON_PLAIN_REGEXP = new RegExp(
  regexp`
    ^ [-?:] (?=$|\s|[,\[\]\{\}])
    # | [,\[\]\{\}] # only banned in flow
    | ^\s
    | \s$
  `.source,
  'u',
);

export function canBePlainScalar(content: string) {
  return !NON_PLAIN_REGEXP.test(content);
}
