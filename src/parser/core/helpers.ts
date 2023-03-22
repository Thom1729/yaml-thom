import { type CharSet } from './charSet';
import { type Parameters } from './ast';

export type GrammarNode =
  | string
  | ((p: Required<Parameters>) => GrammarNode)
  | CharSet
  | { type: 'NAMED', name: string, child: GrammarNode }
  | { type: 'EMPTY' }
  | { type: 'START_OF_LINE' }
  | { type: 'END_OF_INPUT' }
  | { type: 'STRING', string: string }
  | { type: 'REF', name: string, parameters: Parameters }
  | { type: 'SEQUENCE', children: readonly GrammarNode[] }
  | { type: 'FIRST', children: readonly GrammarNode[] }
  | { type: 'REPEAT', child: GrammarNode, min: number, max: number }
  | { type: 'LOOKAHEAD', child: GrammarNode, positive: boolean }
  | { type: 'LOOKBEHIND', charSet: CharSet }
  | { type: 'DETECT_INDENTATION', min: number, child: (m: number) => GrammarNode }
;

export type Grammar = { [K in string]?: GrammarNode };

export function named(name: string, child: GrammarNode) {
  return { type: 'NAMED', name, child } as const;
}

export const empty = { type: 'EMPTY' } as const;
export const startOfLine = { type: 'START_OF_LINE' } as const;
export const endOfInput = { type: 'END_OF_INPUT' } as const;

//////////

export function str<T extends string>(string: T) {
  return { type: 'STRING', string } as const;
}

export function ref<const Name extends string>(name: Name, parameters: Parameters) {
  return { type: 'REF', name, parameters } as const;
}

export function sequence<const Children extends readonly GrammarNode[]>(...children: Children) {
  return { type: 'SEQUENCE', children } as const;
}

export function first<const Children extends readonly GrammarNode[]>(...children: Children) {
  return { type: 'FIRST', children } as const;
}

export function optional<const Child extends GrammarNode>(child: Child) {
  return repeat(child, 0, 1);
}

export function star<const Child extends GrammarNode>(child: Child) {
  return repeat(child, 0, Infinity);
}

export function plus<const Child extends GrammarNode>(child: Child) {
  return repeat(child, 1, Infinity);
}

export function repeat<const Child extends GrammarNode>(child: Child, min: number, max: number) {
  return { type: 'REPEAT', child, min, max } as const;
}

export function lookahead<const Child extends GrammarNode>(child: Child) {
  return { type: 'LOOKAHEAD', child, positive: true } as const;
}

export function negativeLookahead<const Child extends GrammarNode>(child: Child) {
  return { type: 'LOOKAHEAD', child, positive: false } as const;
}

export function lookbehind(charSet: CharSet) {
  return { type: 'LOOKBEHIND', charSet } as const;
}

export function detectIndentation<const Child extends GrammarNode>(min: number, child: (m: number) => Child) {
  return { type: 'DETECT_INDENTATION', min, child } as const;
}

export function minus<Child extends GrammarNode>(p: Child, ...rest: readonly GrammarNode[]) {
  return [negativeLookahead(first(...rest)), p];
}

//////////

export function context<T extends string>(
  c: T,
  cases: { [K in T]?: GrammarNode },
) {
  const result = cases[c];
  if (result === undefined) {
    throw new TypeError(`Unexpected context type ${c}`);
  } else {
    return result as GrammarNode;
  }
}