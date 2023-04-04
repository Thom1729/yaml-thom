import type { AstNode } from './ast';

import {
  strictEntries, strictFromEntries, strictKeys, strictValues,
} from '@/util';

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
    } else if (names.ignore?.includes(node.name)) {
      // pass
    } else if (names.recurse?.includes(node.name)) {
      yield* iterateAst(node.content, names);
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

export function groupNodes<const T extends string>(
  nodes: readonly AstNode[],
  transformation: {
    return: { [K in T]: readonly string[] },
    recurse?: readonly string[],
    ignore?: readonly string[],
  },
  text?: string,
) {
  const returnSpecs = strictKeys(transformation.return);

  if (text === undefined && returnSpecs.some(q => q.endsWith('%'))) {
    throw new TypeError('text not given');
  }

  const returnNameForNodeName = strictFromEntries(
    strictEntries(transformation.return).flatMap(([className, nodeNames]) =>
      nodeNames.map(nodeName => [nodeName, unquantify(className)] as const)
    )
  );

  const byName = strictFromEntries(
    strictKeys(transformation.return)
      .map(s => [unquantify(s), [] as AstNode[]])
  );

  for (const node of iterateAst(nodes, {
    return: strictValues(transformation.return).flatMap(a => a),
    recurse: transformation.recurse,
    ignore: transformation.ignore,
  })) {
    byName[returnNameForNodeName[node.name]].push(node);
  }

  return Object.fromEntries(
    returnSpecs.map(quantified => {
      const m = QUANTIFIED_EXPR.exec(quantified);
      const { name, quantifier = '', string } = m!.groups!;

      const nodesOrText = string
        ? byName[name as Unquantify<T>].map(node => (text as string).slice(...node.range))
        : byName[name as Unquantify<T>];

      const ret = helper(name, nodesOrText, quantifier);

      return [name, ret];
    })
  ) as {
    [K in T as Unquantify<K>]:
      K extends `${string}?%` ? string | null :
      K extends `${string}*%` ? readonly string[] :
      K extends `${string}+%` ? readonly [string, ...string[]] :
      K extends `${string}%` ? string :
      K extends `${string}?` ? AstNode | null :
      K extends `${string}*` ? readonly AstNode[] :
      K extends `${string}+` ? readonly [AstNode, ...AstNode[]] :
      AstNode
  };
}
