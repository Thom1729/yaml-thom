import {
  Alias,
  SerializationScalar,
  SerializationSequence,
  SerializationMapping,
  NonSpecificTag,
  type SerializationNode,
  type SerializationValueNode,
  type RepresentationNode,
} from '@/nodes';

import {
  coreSchema,
  type Schema,
} from '@/composer';

import { canBePlainScalar } from '@/scalar';

import {
  applyStrategy, type Strategies, type StrategyOptions,
  iterate,
} from '@/util';

//////////

function unresolveQuestion(node: RepresentationNode, options: SerializeOptions): NonSpecificTag | undefined {
  if (node.kind === 'scalar' && !canBePlainScalar(node.content)) {
    return undefined;
  } else if (options.schema.resolveNode({ ...node, tag: NonSpecificTag.question }) === node.tag) {
    return NonSpecificTag.question;
  } else {
    return undefined;
  }
}

function unresolveExclamation(node: RepresentationNode, options: SerializeOptions): NonSpecificTag | undefined {
  if (options.schema.resolveNode({ ...node, tag: NonSpecificTag.exclamation }) === node.tag) {
    return NonSpecificTag.exclamation;
  } else {
    return undefined;
  }
}

const unresolveStrategies = {
  '?': unresolveQuestion,
  '!': unresolveExclamation,
} satisfies Strategies<NonSpecificTag, [RepresentationNode, SerializeOptions]>;

type UnresolveOptions = StrategyOptions<typeof unresolveStrategies>;

//////////

export interface SerializeOptions {
  schema: Schema;
  anchorNames: Iterable<string>;
  unresolve: UnresolveOptions,
  preserveKeyOrder: boolean,
}

const DEFAULT_OPTIONS: SerializeOptions = {
  schema: coreSchema,
  anchorNames: { *[Symbol.iterator]() {
    for (let i = 0;; i++) {
      yield i.toString();
    }
  } },
  unresolve: ['?', '!'],
  preserveKeyOrder: true,
} satisfies SerializeOptions;

export function serialize(doc: RepresentationNode, options: Partial<SerializeOptions> = {}) {
  return new SerializeOperation({
    ...DEFAULT_OPTIONS,
    ...options,
  }).serialize(doc);
}

class SerializeOperation {
  readonly options: SerializeOptions;
  readonly anchorNameGenerator: Iterator<string>;
  readonly cache = new Map<RepresentationNode, SerializationValueNode>();

  constructor(options: SerializeOptions) {
    this.options = options;
    this.anchorNameGenerator = iterate(this.options.anchorNames);
  }

  serialize(node: RepresentationNode): SerializationNode {
    const cachedNode = this.cache.get(node);
    if (cachedNode !== undefined) {
      if (cachedNode.anchor === null) {
        const result = this.anchorNameGenerator.next();
        if (result.done) throw new Error(`Anchor name generator is exhausted`);
        cachedNode.anchor = result.value;
      }
      return new Alias(cachedNode.anchor);
    }

    const tag = applyStrategy(unresolveStrategies, this.options.unresolve, [node, this.options]) ?? node.tag;

    if (node.kind === 'scalar') {
      const ret = new SerializationScalar(tag, node.content);
      this.cache.set(node, ret);
      return ret;
    } else if (node.kind === 'sequence') {
      const ret = new SerializationSequence(tag, []);
      this.cache.set(node, ret);
      for (const child of node) {
        ret.content.push(this.serialize(child));
      }
      return ret;
    } else if (node.kind === 'mapping') {
      const ret = new SerializationMapping(tag, []);
      this.cache.set(node, ret);

      let pairs;
      if (this.options.preserveKeyOrder) {
        pairs = Array.from(node).sort((a, b) =>
          (a[0].presentation.index ?? Infinity) - (b[0].presentation.index ?? Infinity)
        );
      } else {
        pairs = node;
      }

      for (const [key, value] of pairs) {
        ret.content.push([this.serialize(key), this.serialize(value)]);
      }
      return ret;
    } else {
      throw new Error('unreachable');
    }
  }
}
