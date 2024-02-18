import type {
  RepresentationNode,
  RepresentationScalar,
  RepresentationSequence,
  RepresentationMapping,
} from '@/index';

type Validator = RepresentationMapping<
  'tag:yaml.org,2002:map',
  
  | readonly [
      RepresentationScalar<'tag:yaml.org,2002:str', 'additionalProperties'>,
      Validator
    ]
  | readonly [
      RepresentationScalar<'tag:yaml.org,2002:str', 'anyOf'>,
      RepresentationSequence<'tag:yaml.org,2002:seq', Validator>
    ]
  | readonly [
      RepresentationScalar<'tag:yaml.org,2002:str', 'id'>,
      RepresentationScalar<'tag:yaml.org,2002:str', string>
    ]
  | readonly [
      RepresentationScalar<'tag:yaml.org,2002:str', 'items'>,
      Validator
    ]
  | readonly [
      RepresentationScalar<'tag:yaml.org,2002:str', 'kind'>,
      NodeKind | RepresentationSequence<'tag:yaml.org,2002:seq', NodeKind>
    ]
  | readonly [
      RepresentationScalar<'tag:yaml.org,2002:str', 'name'>,
      RepresentationScalar<'tag:yaml.org,2002:str', string>
    ]
  | readonly [
      RepresentationScalar<'tag:yaml.org,2002:str', 'properties'>,
      RepresentationMapping<
        'tag:yaml.org,2002:map',
        readonly [RepresentationNode, Validator]
      >
    ]
  | readonly [
      RepresentationScalar<'tag:yaml.org,2002:str', 'requiredProperties'>,
      RepresentationSequence<'tag:yaml.org,2002:seq'>
    ]
  | readonly [
      RepresentationScalar<'tag:yaml.org,2002:str', 'tag'>,
      Tag | RepresentationSequence<'tag:yaml.org,2002:seq', Tag>
    ]
>;

type NodeKind = 
| RepresentationScalar<'tag:yaml.org,2002:str', 'mapping'>
| RepresentationScalar<'tag:yaml.org,2002:str', 'scalar'>
| RepresentationScalar<'tag:yaml.org,2002:str', 'sequence'>;

type Tag = RepresentationScalar<'tag:yaml.org,2002:str', string>;

