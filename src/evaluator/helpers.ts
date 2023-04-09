import type {
  RepresentationScalar,
  RepresentationSequence,
  RepresentationMapping,
  RepresentationNode,
} from '@/nodes';

export function isStr(node: RepresentationNode): node is RepresentationScalar<'tag:yaml.org,2002:str'> {
  return node.kind === 'scalar' && node.tag === 'tag:yaml.org,2002:str';
}

export function assertStr(node: RepresentationNode, message?: string): asserts node is RepresentationScalar<'tag:yaml.org,2002:str'> {
  if (node.kind !== 'scalar' && node.tag !== 'tag:yaml.org,2002:str') throw new TypeError(message ?? 'expected str')
}

export function isNull(node: RepresentationNode): node is RepresentationScalar<'tag:yaml.org,2002:null'> {
  return node.kind === 'scalar' && node.tag === 'tag:yaml.org,2002:null';
}

export function assertNull(node: RepresentationNode, message?: string): asserts node is RepresentationScalar<'tag:yaml.org,2002:null'> {
  if (node.kind !== 'scalar' && node.tag !== 'tag:yaml.org,2002:null') throw new TypeError(message ?? 'expected null');
}

export function isSeq(node: RepresentationNode): node is RepresentationSequence<'tag:yaml.org,2002:seq'> {
  return node.kind === 'sequence' && node.tag === 'tag:yaml.org,2002:seq';
}

export function assertSeq(node: RepresentationNode, message?: string): asserts node is RepresentationSequence<'tag:yaml.org,2002:seq'> {
  if (node.kind !== 'sequence' && node.tag !== 'tag:yaml.org,2002:seq') throw new TypeError(message ?? 'expected seq');
}

export function isMap(node: RepresentationNode): node is RepresentationMapping<'tag:yaml.org,2002:map'> {
  return node.kind === 'mapping' && node.tag === 'tag:yaml.org,2002:map';
}

export function assertMap(node: RepresentationNode, message?: string): asserts node is RepresentationMapping<'tag:yaml.org,2002:map'> {
  if (node.kind !== 'mapping' && node.tag !== 'tag:yaml.org,2002:map') throw new TypeError(message ?? 'expected map')
}

export function isAnnotation(node: RepresentationNode): node is RepresentationMapping<'tag:yaml.org,2002:annotation'> {
  return node.kind === 'mapping' && node.tag === 'tag:yaml.org,2002:annotation';
}
