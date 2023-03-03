export type Primitive =
| string
| number
| bigint
| boolean
| null
| undefined;

export type Split<S extends string, Delimiter extends string> =
  S extends `${infer First}${Delimiter}${infer Rest}`
    ? [First, ...Split<Rest, Delimiter>]
    : [S];

export type Join<T extends readonly Primitive[], Delimiter extends string> =
  T extends readonly [infer First extends Primitive, ...(infer Rest extends [Primitive, ...Primitive[]])]
    ? `${First}${Delimiter}${Join<Rest, Delimiter>}` :
  T extends readonly [infer First extends Primitive]
    ? `${First}`
    : '';

// export type Reverse<T extends readonly unknown[]> =
//   T extends readonly [infer First, ...(infer Rest)]
//     ? [...Reverse<Rest>, First]
//     : [];

export type FromSnake<S extends string> = Split<S, '-'>;

export type ToPascal<S extends [...string[]]> =
  S extends [infer First extends string, ...(infer Rest extends string[])]
    ? `${Capitalize<First>}${ToPascal<Rest>}`
    : '';

export type ToCamel<S extends [...string[]]> =
  S extends [infer First extends string, ...(infer Rest extends string[])]
    ? `${First}${ToPascal<Rest>}`
    : '';

export function capitalize<S extends string>(s: S) {
  return (
    (s === '') ? '' : s[0].toUpperCase() + s.slice(1)
  ) as Capitalize<S>;
}

export function fromSnake<S extends string>(s: S) {
  return s.split('-') as FromSnake<S>;
}

export function toPascal<T extends [...string[]]>(parts: T) {
  return parts.map(capitalize).join('') as ToPascal<T>;
}

export function toCamel<T extends [...string[]]>(parts: T) {
  return (
    parts.length > 0
      ? parts[0] + toPascal(parts.slice(1))
      : ''
  ) as ToCamel<T>;
}

export function repeat(count: number, s: string) {
  return new Array(count + 1).join(s);
}
