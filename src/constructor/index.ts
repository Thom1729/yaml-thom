import type { RepresentationNode } from '@/nodes';

import { transformer, type Result, type Transformer } from './transformer';

type BasicValue =
| string
| bigint
| number
| boolean
| null
| BasicValue[]
| { [key: string]: BasicValue };

import { parseDecimal } from '@/util';

function scalarConstructor<TInnerReturn>(f: (content: string) => TInnerReturn) {
  return <TReturn>(
    node: RepresentationNode,
    result: (value: TInnerReturn) => Result<RepresentationNode, TReturn>,
  ) => {
    if (node.kind !== 'scalar') throw new TypeError('expected scalar');
    return result(f(node.content));
  };
}

function constructArray<TReturn>(
  node: RepresentationNode,
  result: <U extends TReturn[]>(
    value: U,
    deferred?: (value: U, recurse: (value: RepresentationNode) => TReturn) => void,
  ) => Result<RepresentationNode, TReturn>,
) {
  if (node.kind !== 'sequence') throw new TypeError('expected sequence');
  return result<TReturn[]>([], (value, recurse) => {
    for (const child of node) {
      value.push(recurse(child));
    }
  });
}

function constructObject<TReturn>(
  node: RepresentationNode,
  result: <U extends { [key: string]: TReturn }>(
    value: U,
    deferred?: (value: U, recurse: (value: RepresentationNode) => TReturn) => void,
  ) => Result<RepresentationNode, TReturn>,
) {
  if (node.kind !== 'mapping') throw new TypeError('expected mapping');
  return result<{ [key: string]: TReturn }>({}, (ret, recurse) => {
    for (const [k, v] of node) {
      const key = recurse(k);
      if (typeof key !== 'string') throw new TypeError('non-string key');
      const value = recurse(v);
      ret[key] = value;
    }
  });
}

function makeConstructor<TReturn>(
  byTag: { [tag: string]: Transformer<RepresentationNode, TReturn> },
) {
  return transformer<RepresentationNode, TReturn>((node, result) => {
    const constructor = byTag[node.tag];
    if (constructor === undefined) {
      throw new TypeError(`No constructor for tag ${node.tag}`);
    } else {
      return constructor(node, result);
    }
  });
}

export const defaultConstructor = makeConstructor<BasicValue>({
  'tag:yaml.org,2002:str': scalarConstructor(s => s),
  'tag:yaml.org,2002:int': scalarConstructor(BigInt),
  'tag:yaml.org,2002:float': scalarConstructor(parseDecimal),
  'tag:yaml.org,2002:bool': scalarConstructor(s => s === 'true'),
  'tag:yaml.org,2002:null': scalarConstructor(() => null),

  'tag:yaml.org,2002:seq': constructArray,
  'tag:yaml.org,2002:map': constructObject,
});
