import { type CharSet } from './charSet';
import { type Parameters } from './ast';

export type GrammarNode =
  | string
  | ((p: Required<Parameters>) => GrammarNode)
  | GrammarNode[]
  | CharSet
  | { type: 'NAMED', name: string, child: GrammarNode }
  | { type: 'EMPTY' }
  | { type: 'START_OF_LINE' }
  | { type: 'END_OF_INPUT' }
  | { type: 'STRING', string: string }
  | { type: 'REF', name: string, parameters: Parameters }
  | { type: 'FIRST', children: GrammarNode[] }
  | { type: 'REPEAT', child: GrammarNode, min: number, max: number }
  | { type: 'LOOKAHEAD', child: GrammarNode, positive: boolean }
  | { type: 'LOOKBEHIND', charSet: CharSet }
  | { type: 'DETECT_INDENTATION', min: number, child: (m: number) => GrammarNode }
  // | { type: 'DETECT_BLOCK_SCALAR_INDENTATION', min: number, child: (m: number) => GrammarNode }
;

export type Grammar = { [K in string]: GrammarNode };

export function named(name: string, child: GrammarNode) {
  return { type: 'NAMED', name, child } as const;
}

export const empty = { type: 'EMPTY' } as const;
export const startOfLine = { type: 'START_OF_LINE' } as const;
export const endOfInput = { type: 'END_OF_INPUT' } as const;

//////////

export function str(string: string) {
  return { type: 'STRING', string } as const;
}

export function ref(name: string, parameters: Parameters) {
  return { type: 'REF', name, parameters } as const;
}

export function first(...children: GrammarNode[]) {
  return { type: 'FIRST', children } as const;
}

export function optional(child: GrammarNode) {
  return repeat(child, 0, 1);
}

export function star(child: GrammarNode) {
  return repeat(child, 0, Infinity);
}

export function plus(child: GrammarNode) {
  return repeat(child, 1, Infinity);
}

export function repeat(child: GrammarNode, min: number, max: number) {
  return { type: 'REPEAT', child, min, max } as const;
}

export function lookahead(child: GrammarNode) {
  return { type: 'LOOKAHEAD', child, positive: true } as const;
}

export function negativeLookahead(child: GrammarNode) {
  return { type: 'LOOKAHEAD', child, positive: false } as const;
}

export function lookbehind(charSet: CharSet) {
  return { type: 'LOOKBEHIND', charSet } as const;
}

export function detectIndentation(min: number, child: (m: number) => GrammarNode) {
  return { type: 'DETECT_INDENTATION', min, child } as const;
}

// export function detectBlockScalarIndentation(min: number, child: (m: number) => GrammarNode) {
//   return { type: 'DETECT_BLOCK_SCALAR_INDENTATION', min, child } as const;
// }

//////////

export function context<T extends string>(
  c: T,
  cases: { [K in T]?: GrammarNode },
) {
  const result = cases[c];
  if (result === undefined) {
    throw new TypeError(`Unexpected context type ${c}`);
  } else {
    return result!;
  }
}
