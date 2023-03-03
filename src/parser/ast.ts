export type Range = readonly [number, number];

export interface AstNode<T = string> {
  name: T;
  parameters: Parameters,
  content: readonly AstNode[];
  range: Range,
}

export interface Parameters {
  n?: number,
  c?: ContextType,
  t?: ChompingBehavior,
};

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

export function printParseTree(text: string, node: AstNode, depth: number = 0) {
  process.stdout.write(new Array(depth + 1).join('  '));
  const params = [node.parameters.n, node.parameters.c].filter(p => p !== undefined);
  console.log(
    node.name + (params.length ? `(${params.join(',')})` : ''),
    node.range,
    JSON.stringify(text.slice(...node.range)),
  );
  for (const child of node.content) {
    printParseTree(text, child, depth + 1);
  }
}
