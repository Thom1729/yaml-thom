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

export function extractStringMap<T extends string>(node: RepresentationNode, keys: readonly T[]) {
  assertMap(node);
  return _extractStringMap(Array.from(node), keys);
}

export function _extractStringMap<T extends string>(
  pairs: readonly (readonly [RepresentationNode, RepresentationNode])[],
  keys: readonly T[],
) {
  const keySet = new Set(keys.map(k => k.endsWith('?') ? k.slice(0, -1) : k));
  const ret = Object.fromEntries(
    pairs.map(([keyNode, value]) => {
      const key = extractStrContent(keyNode);
      if (!keySet.has(key)) throw new TypeError(`Unexpected key ${key}`);

      return [key, value];
    })
  );

  const missing = keys.filter(k => !k.endsWith('?') && !Object.hasOwn(ret, k));
  if (missing.length > 0) throw new TypeError(`Missing keys ${missing.join(', ')}`);

  return ret as {
    [K in T as (K extends `${infer L}?` ? L : K)]:
      RepresentationNode | (K extends `${string}?` ? undefined : never)
  };
}

export function extractAnnotationInfo(annotation: RepresentationMapping<'tag:yaml.org,2002:annotation'>) {
  const { name, value, arguments: args } = _extractStringMap(Array.from(annotation), ['name', 'value', 'arguments']);

  return {
    name: extractStrContent(name),
    value: value,
    arguments: extractSeqItems(args),
  };
}

export function extractBool(node: RepresentationScalar<'tag:yaml.org,2002:bool'>) {
  return node.content === 'true';
}

export function extractInt(node: RepresentationScalar<'tag:yaml.org,2002:int'>) {
  return BigInt(node.content);
}

//////////

export function str(value: string) {
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

export function map(items: Iterable<readonly [RepresentationNode, RepresentationNode]>) {
  return new RepresentationMapping('tag:yaml.org,2002:map', Array.from(items));
}
