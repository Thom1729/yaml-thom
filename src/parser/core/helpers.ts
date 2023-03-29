import { type CharSet } from './charSet';
import { type Parameters } from './ast';
import { objectEntries, strictFromEntries } from '@/util';

export type RefParameters = {
  [K in keyof Parameters]?:
  | keyof Parameters
  | Required<Parameters>[K]
  | ('n' | 'm' | number)[]
  | 'in-flow(c)'
};

export type GrammarNode =
  | string
  | CharSet
  | { type: 'EMPTY' }
  | { type: 'START_OF_LINE' }
  | { type: 'END_OF_INPUT' }
  | { type: 'STRING', string: string }
  | { type: 'REF', name: string, parameters: RefParameters }
  | { type: 'SEQUENCE', children: readonly GrammarNode[] }
  | { type: 'FIRST', children: readonly GrammarNode[] }
  | { type: 'REPEAT', child: GrammarNode, min: number, max: number }
  | { type: 'LOOKAHEAD', child: GrammarNode, positive: boolean }
  | { type: 'LOOKBEHIND', child: GrammarNode }
  | { type: 'DETECT_INDENTATION', min: number | ((n: number) => number), child: GrammarNode }
  | { type: 'CONTEXT', cases: readonly [Parameters, GrammarNode][] }
;

export type ProductionBody = GrammarNode | ((p: Required<Parameters>) => GrammarNode);

export type Grammar = { [K in string]?: ProductionBody };

export const empty = { type: 'EMPTY' } as const;
export const startOfLine = { type: 'START_OF_LINE' } as const;
export const endOfInput = { type: 'END_OF_INPUT' } as const;

//////////

export function str<T extends string>(string: T) {
  return { type: 'STRING', string } as const;
}

export function ref<const Name extends string>(name: Name, ...args: (RefParameters | keyof Parameters)[]) {
  const parameters = strictFromEntries(
    args.flatMap(arg =>
      typeof arg === 'string'
        ? [[arg, arg] as const] as any
        : objectEntries(arg)
    )
  );
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

export function lookbehind(child: GrammarNode) {
  return { type: 'LOOKBEHIND', child } as const;
}

export function detectIndentation<const Child extends GrammarNode>(min: number | ((n: number) => number), child: Child) {
  return { type: 'DETECT_INDENTATION', min, child } as const;
}

export function minus<Child extends GrammarNode>(p: Child, ...rest: readonly GrammarNode[]) {
  return sequence(negativeLookahead(first(...rest)), p);
}

//////////

export function context<T extends keyof Parameters>(
  ...cases: readonly [Parameters, GrammarNode][]
) {
  return {
    type: 'CONTEXT',
    cases,
  } as const;
}
