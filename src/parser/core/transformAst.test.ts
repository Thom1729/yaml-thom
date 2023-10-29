import type { AstNode } from './ast';

import { groupNodes } from './transformAst';

function node(name: string, content: readonly AstNode[] = []): AstNode {
  return { name, parameters: {}, content, range: [{ index: 0, row: 0, column: 0 }, { index: 0, row: 0, column: 0 }] };
}

describe(groupNodes, () => {
  const ast = node('foo', [
    node('bar'),
    node('bar'),
  ]);

  test('', () => {
    const result = groupNodes(ast.content, {
      return: { 'bar+': ['bar'] },
    });

    expect(result.bar).toEqual([
      node('bar'),
      node('bar'),
    ]);
  });

  test('', () => {
    const result = groupNodes([ast], {
      return: { foo: ['foo'] },
    });

    expect(result.foo).toEqual(node('foo', [
      node('bar'),
      node('bar'),
    ]));
  });

  test('', () => {
    const result = groupNodes([ast], {
      return: { 'bar*': ['bar'] },
      ignore: ['foo'],
    });

    expect(result.bar).toEqual([]);
  });
});
