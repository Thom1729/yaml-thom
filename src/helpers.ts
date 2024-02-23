import {
  RepresentationScalar,
  RepresentationSequence,
  RepresentationMapping,
  RepresentationNode,
} from '@/nodes';

export function isStr(node: RepresentationNode): node is RepresentationScalar<'tag:yaml.org,2002:str'> {
  return node.kind === 'scalar' && node.tag === 'tag:yaml.org,2002:str';
}

export function assertStr(node: RepresentationNode, message?: string): asserts node is RepresentationScalar<'tag:yaml.org,2002:str'> {
  if (!isStr(node)) throw new TypeError(message ?? 'expected str');
}

export function isNull(node: RepresentationNode): node is RepresentationScalar<'tag:yaml.org,2002:null'> {
  return node.kind === 'scalar' && node.tag === 'tag:yaml.org,2002:null';
}

export function assertNull(node: RepresentationNode, message?: string): asserts node is RepresentationScalar<'tag:yaml.org,2002:null'> {
  if (!isNull(node)) throw new TypeError(message ?? 'expected null');
}

export function isBool(node: RepresentationNode): node is RepresentationScalar<'tag:yaml.org,2002:bool'> {
  return node.kind === 'scalar' && node.tag === 'tag:yaml.org,2002:bool';
}

export function assertBool(node: RepresentationNode, message?: string): asserts node is RepresentationScalar<'tag:yaml.org,2002:bool'> {
  if (!isBool(node)) throw new TypeError(message ?? 'expected bool');
}

export function isInt(node: RepresentationNode): node is RepresentationScalar<'tag:yaml.org,2002:int'> {
  return node.kind === 'scalar' && node.tag === 'tag:yaml.org,2002:int';
}

export function assertInt(node: RepresentationNode, message?: string): asserts node is RepresentationScalar<'tag:yaml.org,2002:int'> {
  if (!isInt(node)) throw new TypeError(message ?? 'expected int');
}

export function isFloat(node: RepresentationNode): node is RepresentationScalar<'tag:yaml.org,2002:float'> {
  return node.kind === 'scalar' && node.tag === 'tag:yaml.org,2002:float';
}

export function isSeq(node: RepresentationNode): node is RepresentationSequence<'tag:yaml.org,2002:seq'> {
  return node.kind === 'sequence' && node.tag === 'tag:yaml.org,2002:seq';
}

export function assertSeq(node: RepresentationNode, message?: string): asserts node is RepresentationSequence<'tag:yaml.org,2002:seq'> {
  if (!isSeq(node)) throw new TypeError(message ?? 'expected seq');
}

export function isMap(node: RepresentationNode): node is RepresentationMapping<'tag:yaml.org,2002:map'> {
  return node.kind === 'mapping' && node.tag === 'tag:yaml.org,2002:map';
}

export function assertMap(node: RepresentationNode, message?: string): asserts node is RepresentationMapping<'tag:yaml.org,2002:map'> {
  if (!isMap(node)) throw new TypeError(message ?? 'expected map');
}

export function isAnnotation(node: RepresentationNode): node is RepresentationMapping<'tag:yaml.org,2002:annotation'> {
  return node.kind === 'mapping' && node.tag === 'tag:yaml.org,2002:annotation';
}

//////////

export function extractStrContent(node: RepresentationNode) {
  assertStr(node);
  return node.content;
}

export function extractSeqItems(node: RepresentationNode): RepresentationNode[] {
  assertSeq(node);
  return Array.from(node);
}

export function extractMapEntries(node: RepresentationNode): (readonly [RepresentationNode, RepresentationNode])[] {
  assertMap(node);
  return Array.from(node);
}

type GetFromPairsByKey<
  PairType extends readonly [unknown, unknown],
  KeyType extends PairType[0],
> =
  PairType extends readonly [infer PairKey, infer PairValue]
    ? (KeyType extends PairKey ? PairValue : never)
    : never
;

type StringMap<
  TPairs extends readonly [string, RepresentationNode] = readonly [string, RepresentationNode],
  TRequiredKeys extends TPairs[0] = never,
> = RepresentationMapping<
  string,
  TPairs extends readonly [infer TKey extends string, infer TValue extends RepresentationNode]
    ? readonly [
      RepresentationScalar<'tag:yaml.org,2002:str', TKey>,
      TValue,
    ]
    : never,
  {
    [K in TRequiredKeys]: RepresentationScalar<'tag:yaml.org,2002:str', K>
  }[TRequiredKeys]
>;

type ExtractTypedStringMap<
  T extends StringMap,
  // Pass as separate parameter to avoid distribution over union
  TAllKeys extends RepresentationScalar,
> =
  T extends RepresentationMapping<
    string,
    infer PairType extends readonly [RepresentationScalar<'tag:yaml.org,2002:str'>, RepresentationNode],
    infer RequiredKeys
  >
    ? {
      [K in TAllKeys['content']]:
        K extends PairType[0]['content']
          ? (
            | GetFromPairsByKey<PairType, RepresentationScalar<'tag:yaml.org,2002:str', K>>
            | (K extends RequiredKeys['content'] ? never : undefined)
          )
          : undefined
    }
    : never;

export function extractTypedStringMap<
  T extends StringMap
>(node: T) {
  return Object.fromEntries(
    Array.from(node).map(([key, value]) => [key.content, value])
  ) as ExtractTypedStringMap<T, Parameters<T['get']>[0]>;
}

export function extractBool(node: RepresentationScalar<'tag:yaml.org,2002:bool'>) {
  return node.content === 'true';
}

export function extractInt(node: RepresentationScalar<'tag:yaml.org,2002:int'>) {
  return BigInt(node.content);
}

//////////

export function str<ContentType extends string>(value: ContentType) {
  return new RepresentationScalar('tag:yaml.org,2002:str', value);
}

export function nullValue() {
  return new RepresentationScalar('tag:yaml.org,2002:null', 'null');
}

export function bool(value: boolean) {
  return new RepresentationScalar('tag:yaml.org,2002:bool', value.toString());
}

export function int(value: bigint) {
  return new RepresentationScalar('tag:yaml.org,2002:int', value.toString());
}

export function seq(items: Iterable<RepresentationNode>) {
  return new RepresentationSequence('tag:yaml.org,2002:seq', Array.from(items));
}

export function map<PairType extends readonly [RepresentationNode, RepresentationNode]>(items: Iterable<PairType>) {
  return new RepresentationMapping('tag:yaml.org,2002:map', items);
}
