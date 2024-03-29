import type {
  RepresentationNode,
  RepresentationScalar,
  RepresentationSequence,
  RepresentationMapping,
} from '@/index';

export type Annotation = RepresentationMapping<
  'tag:yaml.org,2002:annotation',
  | readonly [
      RepresentationScalar<'tag:yaml.org,2002:str', 'arguments'>,
      RepresentationSequence<'tag:yaml.org,2002:seq'>
    ]
  | readonly [
      RepresentationScalar<'tag:yaml.org,2002:str', 'name'>,
      RepresentationScalar<'tag:yaml.org,2002:str'>
    ]
  | readonly [
      RepresentationScalar<'tag:yaml.org,2002:str', 'value'>,
      RepresentationNode
    ],
  | RepresentationScalar<'tag:yaml.org,2002:str', 'arguments'>
  | RepresentationScalar<'tag:yaml.org,2002:str', 'name'>
  | RepresentationScalar<'tag:yaml.org,2002:str', 'value'>
>;

export type Validator = RepresentationMapping<
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
      RepresentationScalar<'tag:yaml.org,2002:str', 'const'>,
      RepresentationNode
    ]
  | readonly [
      RepresentationScalar<'tag:yaml.org,2002:str', 'enum'>,
      RepresentationSequence<'tag:yaml.org,2002:seq'>
    ]
  | readonly [
      RepresentationScalar<'tag:yaml.org,2002:str', 'id'>,
      RepresentationScalar<'tag:yaml.org,2002:str'>
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
      RepresentationScalar<'tag:yaml.org,2002:str', 'maxLength'>,
      RepresentationScalar<'tag:yaml.org,2002:int'>
    ]
  | readonly [
      RepresentationScalar<'tag:yaml.org,2002:str', 'minLength'>,
      RepresentationScalar<'tag:yaml.org,2002:int'>
    ]
  | readonly [
      RepresentationScalar<'tag:yaml.org,2002:str', 'name'>,
      RepresentationScalar<'tag:yaml.org,2002:str'>
    ]
  | readonly [
      RepresentationScalar<'tag:yaml.org,2002:str', 'properties'>,
      RepresentationMapping<
        'tag:yaml.org,2002:map',
        readonly [RepresentationNode, Validator]
      >
    ]
  | readonly [
      RepresentationScalar<'tag:yaml.org,2002:str', 'ref'>,
      RepresentationScalar<'tag:yaml.org,2002:str'>
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

export type NodeKind = | RepresentationScalar<'tag:yaml.org,2002:str', 'mapping'>
| RepresentationScalar<'tag:yaml.org,2002:str', 'scalar'>
| RepresentationScalar<'tag:yaml.org,2002:str', 'sequence'>;

export type Tag = RepresentationScalar<'tag:yaml.org,2002:str'>;

export type EvaluationTest = RepresentationMapping<
  'tag:yaml.org,2002:map',
  | readonly [
      RepresentationScalar<'tag:yaml.org,2002:str', 'context'>,
      RepresentationMapping<
        'tag:yaml.org,2002:map',
        readonly [RepresentationNode, RepresentationNode]
      >
    ]
  | readonly [
      RepresentationScalar<'tag:yaml.org,2002:str', 'error'>,
      RepresentationScalar<'tag:yaml.org,2002:bool'>
    ]
  | readonly [
      RepresentationScalar<'tag:yaml.org,2002:str', 'expected'>,
      RepresentationNode
    ]
  | readonly [
      RepresentationScalar<'tag:yaml.org,2002:str', 'input'>,
      RepresentationNode
    ]
  | readonly [
      RepresentationScalar<'tag:yaml.org,2002:str', 'name'>,
      RepresentationScalar<'tag:yaml.org,2002:str'>
    ],
  RepresentationScalar<'tag:yaml.org,2002:str', 'input'>
>;

export type PresentationTest = RepresentationMapping<
  'tag:yaml.org,2002:map',
  | readonly [
      RepresentationScalar<'tag:yaml.org,2002:str', 'expected'>,
      RepresentationScalar<'tag:yaml.org,2002:str'>
    ]
  | readonly [
      RepresentationScalar<'tag:yaml.org,2002:str', 'input'>,
      RepresentationNode
    ]
  | readonly [
      RepresentationScalar<'tag:yaml.org,2002:str', 'name'>,
      RepresentationScalar<'tag:yaml.org,2002:str'>
    ]
  | readonly [
      RepresentationScalar<'tag:yaml.org,2002:str', 'options'>,
      RepresentationMapping<
        'tag:yaml.org,2002:map',
        | readonly [
            RepresentationScalar<'tag:yaml.org,2002:str', 'doubleQuoteEscapeCharacters'>,
            DoubleQuoteEscapeCharacters | RepresentationSequence<'tag:yaml.org,2002:seq', DoubleQuoteEscapeCharacters>
          ]
        | readonly [
            RepresentationScalar<'tag:yaml.org,2002:str', 'doubleQuoteEscapeStyle'>,
            DoubleQuoteEscapeStyle | RepresentationSequence<'tag:yaml.org,2002:seq', DoubleQuoteEscapeStyle>
          ]
        | readonly [
            RepresentationScalar<'tag:yaml.org,2002:str', 'endMarker'>,
            RepresentationScalar<'tag:yaml.org,2002:bool'>
          ]
        | readonly [
            RepresentationScalar<'tag:yaml.org,2002:str', 'scalarStyle'>,
            ScalarStyle | RepresentationSequence<'tag:yaml.org,2002:seq', ScalarStyle>
          ]
        | readonly [
            RepresentationScalar<'tag:yaml.org,2002:str', 'startMarker'>,
            RepresentationScalar<'tag:yaml.org,2002:bool'>
          ]
        | readonly [
            RepresentationScalar<'tag:yaml.org,2002:str', 'tagShorthands'>,
            RepresentationSequence<'tag:yaml.org,2002:seq', RepresentationSequence<'tag:yaml.org,2002:seq', RepresentationScalar<'tag:yaml.org,2002:str'>>>
          ]
        | readonly [
            RepresentationScalar<'tag:yaml.org,2002:str', 'trailingNewline'>,
            RepresentationScalar<'tag:yaml.org,2002:bool'>
          ]
        | readonly [
            RepresentationScalar<'tag:yaml.org,2002:str', 'unresolve'>,
            NonSpecificTag | RepresentationSequence<'tag:yaml.org,2002:seq', NonSpecificTag>
          ]
        | readonly [
            RepresentationScalar<'tag:yaml.org,2002:str', 'useDefaultTagShorthands'>,
            RepresentationScalar<'tag:yaml.org,2002:bool'>
          ]
        | readonly [
            RepresentationScalar<'tag:yaml.org,2002:str', 'versionDirective'>,
            RepresentationScalar<'tag:yaml.org,2002:bool'>
          ]
      >
    ],
  | RepresentationScalar<'tag:yaml.org,2002:str', 'expected'>
  | RepresentationScalar<'tag:yaml.org,2002:str', 'input'>
>;

export type DoubleQuoteEscapeCharacters = RepresentationScalar<'tag:yaml.org,2002:str', 'all'>;

export type DoubleQuoteEscapeStyle = | RepresentationScalar<'tag:yaml.org,2002:str', 'U'>
| RepresentationScalar<'tag:yaml.org,2002:str', 'builtin'>
| RepresentationScalar<'tag:yaml.org,2002:str', 'json'>
| RepresentationScalar<'tag:yaml.org,2002:str', 'u'>
| RepresentationScalar<'tag:yaml.org,2002:str', 'uu'>
| RepresentationScalar<'tag:yaml.org,2002:str', 'x'>;

export type ScalarStyle = | RepresentationScalar<'tag:yaml.org,2002:str', 'double'>
| RepresentationScalar<'tag:yaml.org,2002:str', 'plain'>
| RepresentationScalar<'tag:yaml.org,2002:str', 'single'>;

export type NonSpecificTag = | RepresentationScalar<'tag:yaml.org,2002:str', '!'>
| RepresentationScalar<'tag:yaml.org,2002:str', '?'>;

export type PathEntry = RepresentationMapping<
    'tag:yaml.org,2002:map',
    | readonly [
        RepresentationScalar<'tag:yaml.org,2002:str', 'index'>,
        RepresentationScalar<'tag:yaml.org,2002:int'>
      ]
    | readonly [
        RepresentationScalar<'tag:yaml.org,2002:str', 'type'>,
        RepresentationScalar<'tag:yaml.org,2002:str', 'index'>
      ],
    | RepresentationScalar<'tag:yaml.org,2002:str', 'index'>
    | RepresentationScalar<'tag:yaml.org,2002:str', 'type'>
  > | RepresentationMapping<
    'tag:yaml.org,2002:map',
    | readonly [
        RepresentationScalar<'tag:yaml.org,2002:str', 'key'>,
        RepresentationNode
      ]
    | readonly [
        RepresentationScalar<'tag:yaml.org,2002:str', 'type'>,
        RepresentationScalar<'tag:yaml.org,2002:str', 'key'>
      ],
    | RepresentationScalar<'tag:yaml.org,2002:str', 'key'>
    | RepresentationScalar<'tag:yaml.org,2002:str', 'type'>
  > | RepresentationMapping<
    'tag:yaml.org,2002:map',
    | readonly [
        RepresentationScalar<'tag:yaml.org,2002:str', 'key'>,
        RepresentationNode
      ]
    | readonly [
        RepresentationScalar<'tag:yaml.org,2002:str', 'type'>,
        RepresentationScalar<'tag:yaml.org,2002:str', 'value'>
      ],
    | RepresentationScalar<'tag:yaml.org,2002:str', 'key'>
    | RepresentationScalar<'tag:yaml.org,2002:str', 'type'>
  >;

export type ValidationFailures = RepresentationSequence<'tag:yaml.org,2002:seq', RepresentationMapping<
    'tag:yaml.org,2002:map',
    | readonly [
        RepresentationScalar<'tag:yaml.org,2002:str', 'children'>,
        ValidationFailures
      ]
    | readonly [
        RepresentationScalar<'tag:yaml.org,2002:str', 'key'>,
        RepresentationScalar<'tag:yaml.org,2002:str'>
      ]
    | readonly [
        RepresentationScalar<'tag:yaml.org,2002:str', 'path'>,
        RepresentationSequence<'tag:yaml.org,2002:seq', PathEntry>
      ],
    | RepresentationScalar<'tag:yaml.org,2002:str', 'key'>
    | RepresentationScalar<'tag:yaml.org,2002:str', 'path'>
  >>;

export type ValidationTest = RepresentationMapping<
  'tag:yaml.org,2002:map',
  | readonly [
      RepresentationScalar<'tag:yaml.org,2002:str', 'failures'>,
      ValidationFailures
    ]
  | readonly [
      RepresentationScalar<'tag:yaml.org,2002:str', 'input'>,
      RepresentationNode
    ]
  | readonly [
      RepresentationScalar<'tag:yaml.org,2002:str', 'valid'>,
      RepresentationScalar<'tag:yaml.org,2002:bool'>
    ]
  | readonly [
      RepresentationScalar<'tag:yaml.org,2002:str', 'validator'>,
      Validator
    ],
  | RepresentationScalar<'tag:yaml.org,2002:str', 'input'>
  | RepresentationScalar<'tag:yaml.org,2002:str', 'validator'>
>;
