import type {
  RepresentationScalar,
  RepresentationSequence,
  RepresentationMapping,
  RepresentationNode,
} from "@/nodes";

export function isStr(node: RepresentationNode): node is RepresentationScalar & { tag: 'tag:yaml.org,2002:str' } {
  return node.kind === 'scalar' && node.tag === 'tag:yaml.org,2002:str';
}

export function isNull(node: RepresentationNode): node is RepresentationScalar & { tag: 'tag:yaml.org,2002:null' } {
  return node.kind === 'scalar' && node.tag === 'tag:yaml.org,2002:null';
}

export function isSeq(node: RepresentationNode): node is RepresentationSequence & { tag: 'tag:yaml.org,2002:seq' } {
  return node.kind === 'sequence' && node.tag === 'tag:yaml.org,2002:seq';
}

export function isMap(node: RepresentationNode): node is RepresentationMapping & { tag: 'tag:yaml.org,2002:map' } {
  return node.kind === 'mapping' && node.tag === 'tag:yaml.org,2002:map';
}

export function isAnnotation(node: RepresentationNode): node is RepresentationMapping & { tag: 'tag:yaml.org,2002:annotation' } {
  return node.kind === 'mapping' && node.tag === 'tag:yaml.org,2002:annotation';
}
