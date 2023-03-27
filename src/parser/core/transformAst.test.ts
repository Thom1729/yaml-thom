import type { AstNode } from './ast';

import { groupNodes } from './transformAst';

function node(name: string, content: readonly AstNode[] = []): AstNode {
  return { name, parameters: {}, content, range: [0, 0] };
}

describe(groupNodes, () => {
  const ast = node('foo', [
    node('bar'),
    node('bar'),
  ]);

  test('', () => {
    const result = groupNodes(ast.content, {
      return: ['bar+'],
    });

    expect(result.bar).toEqual([
      node('bar'),
      node('bar'),
    ]);
  });

  test('', () => {
    const result = groupNodes([ast], {
      return: ['foo'],
    });

    expect(result.foo).toEqual(node('foo', [
      node('bar'),
      node('bar'),
    ]));
  });

  test('', () => {
    const result = groupNodes([ast], {
      return: ['bar*'],
      ignore: ['foo'],
    });

    expect(result.bar).toEqual([]);
  });
});
