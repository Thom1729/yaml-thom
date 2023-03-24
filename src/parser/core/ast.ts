export type Range = readonly [number, number];

export interface AstNode<T = string> {
  name: T;
  parameters: Parameters,
  content: readonly AstNode[];
  range: Range,
}

export interface Parameters {
  n?: number,
  m?: number,
  c?: ContextType,
  t?: ChompingBehavior,
}

const ContextType = {
  'BLOCK-IN': 'BLOCK-IN',
  'BLOCK-OUT': 'BLOCK-OUT',
  'BLOCK-KEY': 'BLOCK-KEY',
  'FLOW-IN': 'FLOW-IN',
  'FLOW-OUT': 'FLOW-OUT',
  'FLOW-KEY': 'FLOW-KEY',
  'ANNOTATION-IN': 'ANNOTATION-IN', // Experimental
} as const;
export type ContextType = typeof ContextType[keyof typeof ContextType];

export const ChompingBehavior = {
  STRIP: 'STRIP',
  CLIP: 'CLIP',
  KEEP: 'KEEP',
} as const;
export type ChompingBehavior = typeof ChompingBehavior[keyof typeof ChompingBehavior];
