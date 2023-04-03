import type { AstNode } from './ast';

import {
  toCamel, fromSnake,
  type ToCamel,
  type FromSnake,
} from '@/util';

////

type AstTransformation<R> = {
  [K in string]?: null | ((
    node: AstNode<K>,
    rec: (node: AstNode) => R,
  ) => R)
};

export function transformAst<
  const R,
>(
  ast: AstNode<string>,
  transformation: AstTransformation<R>,
) {

  function rec(node: AstNode<string>) {
    const f = transformation[node.name];

    if (f === null) {
      return undefined;
    } else if (f !== undefined) {
      return f(node, rec) as R;
    } else {
      throw new TypeError(`Unexpected node named ${node.name}`);
    }
  }

  return rec(ast) as R;
}

////

export function *iterateAst<T extends string>(
  nodes: Iterable<AstNode>,
  names: {
    return: readonly T[],
    recurse?: readonly string[] | undefined,
    ignore?: readonly string[] | undefined,
  },
): Generator<AstNode<T>> {
  for (const node of nodes) {
    if ((names.return as readonly string[]).includes(node.name)) {
      yield node as AstNode<T>;
    } else if (names.recurse?.includes(node.name)) {
      yield* iterateAst(node.content, names);
    } else if (names.ignore?.includes(node.name)) {
      // pass
    } else {
      throw new Error(`Encountered unexpected AST node named ${node.name}`);
    }
  }
}

////

type Unquantify<T extends string> =
  T extends `${infer U extends string}${'?' | '*' | '+' | ''}${'%' | ''}`
    ? U
    : T;

const QUANTIFIED_EXPR = /^(?<name>.*?)(?<quantifier>[?*+])?(?<string>%)?$/;

function unquantify<T extends string>(string: T) {
  return string.replace(/[?*+]?%?$/, '') as Unquantify<T>;
}

export function groupNodes<const T extends string>(
  nodes: readonly AstNode[],
  transformation: {
    return: readonly T[],
    recurse?: readonly string[],
    ignore?: readonly string[],
  },
  text?: string,
) {
  if (text === undefined && transformation.return.some(q => q.endsWith('%'))) {
    throw new TypeError('text not given');
  }

  const byName = Object.fromEntries(
    transformation.return.map(quantified => [unquantify(quantified), [] as AstNode[]])
  ) as Record<string, AstNode[]>;

  for (const node of iterateAst(nodes, {
    return: transformation.return.map(unquantify),
    recurse: transformation.recurse,
    ignore: transformation.ignore,
  })) {
    byName[node.name].push(node);
  }

  return Object.fromEntries(
    transformation.return.map(quantified => {
      const m = QUANTIFIED_EXPR.exec(quantified);
      const { name, quantifier = '', string } = m!.groups!;
      const nodesOrText = string
        ? byName[name].map(node => (text as string).slice(...node.range))
        : byName[name];

      const ret = helper(name, nodesOrText, quantifier);

      return [toCamel(fromSnake(name)), ret];
    })
  ) as {
    [K in T as ToCamel<FromSnake<Unquantify<K>>>]:
      K extends `${string}?%` ? string | null :
      K extends `${string}*%` ? readonly string[] :
      K extends `${string}+%` ? readonly [string, ...string[]] :
      K extends `${string}%` ? string :
      K extends `${infer Name}?` ? AstNode<Name> | null :
      K extends `${infer Name}*` ? readonly AstNode<Name>[] :
      K extends `${infer Name}+` ? readonly [AstNode<Name>, ...AstNode<Name>[]] :
      AstNode<K>
  };
}

function helper(name: string, nodes: readonly unknown[], quantifier: string) {
  switch (quantifier) {
    case '': {
      switch (nodes.length) {
        case 1: return nodes[0];
        default: throw new Error(`Expected one ${name} node but got ${nodes.length}`);
      }
    }
    case '?': {
      switch (nodes.length) {
        case 0: return null;
        case 1: return nodes[0];
        default: throw new Error(`Expected one ${name} node but got ${nodes.length}`);
      }
    }
    case '*': {
      return nodes;
    }
    case '+': {
      switch (nodes.length) {
        case 0: throw new Error(`Expected one or more ${name} node but got ${nodes.length}`);
        default: return nodes;
      }
    }
    default: throw new TypeError(`Unexpected quantifier ${quantifier}`);
  }
}
