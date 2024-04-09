import type { AstNode } from './ast';

import {
  strictEntries, strictFromEntries, strictKeys, strictValues,
  type TypedRegExp,
} from '@/util';

////

function *_iterateAst<
  TName extends string,
  TThisName extends TName,
>(
  nodes: Iterable<AstNode<TName>>,
  names: {
    return: readonly TThisName[],
    recurse?: readonly string[] | undefined,
    ignore?: readonly string[] | undefined,
  },
): Generator<AstNode<TName, TThisName>> {
  for (const node of nodes) {
    if ((names.return as readonly string[]).includes(node.name)) {
      yield node as AstNode<TName, TThisName>;
    } else if (names.ignore?.includes(node.name)) {
      // pass
    } else if (names.recurse?.includes(node.name)) {
      yield* _iterateAst(node.content, names);
    } else {
      yield* _iterateAst(node.content, names);
      // throw new Error(`Encountered unexpected AST node named ${node.name}`);
    }
  }
}

export function iterateAst<
  TName extends string,
  TThisName extends TName,
>(
  nodes: Iterable<AstNode<TName>>,
  names: {
    return: readonly TThisName[],
    recurse?: readonly string[] | undefined,
    ignore?: readonly string[] | undefined,
  },
) {
  return Array.from(_iterateAst(nodes, names));
}

////

export type Quantify<T extends string> = `${T}${'?' | '*' | '+' | ''}${'%' | ''}`;

type Unquantify<T extends string> =
  T extends `${infer U extends string}${'?' | '*' | '+' | ''}${'%' | ''}`
    ? U
    : T;

const QUANTIFIED_EXPR = /^(?<name>.*?)(?<quantifier>[?*+])?(?<string>%)?$/ as TypedRegExp<'name'|'quantifier'|'string'>;

export function unquantify<T extends string>(string: T) {
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

export function groupNodes<
  TName extends string,
  const TReturnMap extends { [K in string]: readonly TName[] },
>(
  nodes: readonly AstNode<TName>[],
  transformation: {
    return: TReturnMap,
    recurse?: readonly string[],
    ignore?: readonly string[],
  },
  nodeText?: (node: AstNode) => string,
) {
  type TReturn = string & keyof TReturnMap;
  const returnSpecs = strictKeys(transformation.return) as readonly TReturn[];

  if (nodeText === undefined && returnSpecs.some(q => q.endsWith('%'))) {
    throw new TypeError('text not given');
  }

  const returnNameForNodeName = strictFromEntries(
    strictEntries(transformation.return).flatMap(([className, nodeNames]) =>
      nodeNames.map(nodeName => [nodeName, unquantify(className as string)] as const)
    )
  );

  const byName = strictFromEntries(
    returnSpecs.map(s => [unquantify(s) as string, [] as AstNode[]])
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
      if (m === null) throw new TypeError(`Invalid name ${quantified}`);
      const { name, quantifier = '', string } = m.groups;

      const nodesOrText = string
        ? byName[name as Unquantify<TReturn>].map(nodeText as (node: AstNode) => string)
        : byName[name as Unquantify<TReturn>];

      const ret = helper(name, nodesOrText, quantifier);

      return [name, ret];
    })
  ) as GroupedNodes<TName, TReturnMap>;
}

type GroupedNodes<
  TName extends string,
  TReturnMap extends { [K in string]: readonly TName[] },
> = {
  [K in (string & keyof TReturnMap) as Unquantify<K>]:
    HandleStringification<TName, TReturnMap, K>
};

type HandleStringification<
  TName extends string,
  TReturnMap extends { [K in string]: readonly TName[] },
  K extends string & keyof TReturnMap,
> = K extends `${infer S extends string}%`
  ? HandleQuantification<S, string>
  : HandleQuantification<K, AstNode<TName, TReturnMap[K][number]>>;

type HandleQuantification<
  K extends string,
  TValue,
> =
  K extends `${string}%` ? TValue :
  K extends `${string}?` ? TValue | null :
  K extends `${string}*` ? readonly TValue[] :
  K extends `${string}+` ? readonly [TValue, ...TValue[]] :
  TValue
;
