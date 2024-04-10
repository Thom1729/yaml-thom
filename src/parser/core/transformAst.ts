import type { AstNode } from './ast';

import {
  assertNotEmpty, assertNotNull, single, singleOrNull,
  groupBy, strictEntries, strictFromEntries,
  type TypedRegExp,
} from '@/util';

////

function *_iterateAst<
  TName extends string,
  TThisName extends TName,
>(
  nodes: Iterable<AstNode<TName>>,
  names: readonly TThisName[],
): Iterable<AstNode<TName, TThisName>> {
  for (const node of nodes) {
    if ((names as readonly string[]).includes(node.name)) {
      yield node as AstNode<TName, TThisName>;
    } else {
      yield* _iterateAst(node.content, names);
    }
  }
}

export function iterateAst<
  TName extends string,
  TThisName extends TName,
>(
  nodes: Iterable<AstNode<TName>>,
  names: readonly TThisName[],
) {
  return Array.from(_iterateAst(nodes, names));
}

////

const QUANTIFIED_EXPR = /^(?<name>.*?)(?<quantifier>[?*+])?(?<string>%)?$/ as TypedRegExp<'name'|'quantifier'|'string'>;

export function groupNodes<
  TName extends string,
  const TReturnMap extends { [K in string]: readonly TName[] },
>(
  nodes: readonly AstNode<TName>[],
  transformation: TReturnMap,
  nodeText?: (node: AstNode<TName>) => string,
) {
  const specs = strictEntries(transformation).map(([spec, names]) => {
    const m = QUANTIFIED_EXPR.exec(spec as string);
    assertNotNull(m);
    return {
      ...m.groups,
      names,
    };
  });

  const returnNameForNodeName = strictFromEntries(
    specs.flatMap(spec => spec.names.map(name => [name, spec.name]))
  );

  const byName = groupBy(
    iterateAst(nodes, specs.flatMap(spec => spec.names)),
    node => returnNameForNodeName[node.name],
  );

  return Object.fromEntries(
    specs.map(spec => {
      const nodes = byName.get(spec.name) ?? [];

      const nodesOrText = spec.string
        ? nodes.map(nodeText as (node: AstNode) => string)
        : nodes;

      return [spec.name, handleQuantifier(spec.name, nodesOrText, spec.quantifier ?? '')];
    })
  ) as GroupedNodes<TName, TReturnMap>;
}

function handleQuantifier(name: string, nodes: readonly unknown[], quantifier: string) {
  switch (quantifier) {
    case '': return single(nodes, `Expected one ${name} node but got ${nodes.length}`);
    case '?': return singleOrNull(nodes, `Expected one or zero ${name} nodes but got ${nodes.length}`);
    case '*': return nodes;
    case '+': {
      assertNotEmpty(nodes, `Expected one or more ${name} node but got none`);
      return nodes;
    }
    default: throw new TypeError(`Unexpected quantifier ${quantifier}`);
  }
}

type GroupedNodes<
  TName extends string,
  TReturnMap extends { [K in string]: readonly TName[] },
> = {
  [KV in HandleStringification<TName, TReturnMap, string & keyof TReturnMap> as KV[0]]: KV[1]
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
  K extends `${infer L extends string}%` ? [L, TValue] :
  K extends `${infer L extends string}?` ? [L, TValue | null] :
  K extends `${infer L extends string}*` ? [L, readonly TValue[]] :
  K extends `${infer L extends string}+` ? [L, readonly [TValue, ...TValue[]]] :
  [K, TValue]
;
