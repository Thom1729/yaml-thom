import { NonSpecificTag, type UnresolvedNode } from '@/nodes';

type Rule = RegExp | string;

export interface Schema {
  resolveNode(node: UnresolvedNode): string | null;
}

export class PredicateSchema {
  strings = new Map<string, string>();
  regExps: [RegExp, string][] = [];

  constructor(rules: readonly [Rule, string][]) {
    for (const [rule, tag] of rules) {
      if (typeof rule === 'string') {
        this.strings.set(rule, tag);
      } else if (rule instanceof RegExp) {
        this.regExps.push([
          new RegExp(`^(?:${rule.source})$`, rule.flags),
          tag,
        ]);
      }
    }
  }

  resolveNode(node: UnresolvedNode) {
    switch (node.kind) {
      case 'sequence': return 'tag:yaml.org,2002:seq';
      case 'mapping': return 'tag:yaml.org,2002:map';
      case 'scalar': {
        switch (node.tag) {
          case NonSpecificTag.exclamation: return 'tag:yaml.org,2002:str';
          case NonSpecificTag.question: return this.resolvePlainScalar(node.content);
          default: throw new Error(`unreachable`);
        }
      }
    }
  }

  resolvePlainScalar(content: string) {
    const stringTag = this.strings.get(content);
    if (stringTag !== undefined) {
      return stringTag;
    }

    for (const [regExp, tag] of this.regExps) {
      if (regExp.exec(content) !== null) {
        return tag;
      }
    }

    return null;
  }
}

export const failsafeSchema = new PredicateSchema([]);

export const jsonSchema = new PredicateSchema([
  ['null', 'tag:yaml.org,2002:null'],
  ['true', 'tag:yaml.org,2002:bool'],
  ['false', 'tag:yaml.org,2002:bool'],
  [/0|-?[1-9][0-9]*/, 'tag:yaml.org,2002:int'],
  ['.inf', 'tag:yaml.org,2002:float'],
  ['-.inf', 'tag:yaml.org,2002:float'],
  ['.nan', 'tag:yaml.org,2002:float'],
  [/-?[1-9](\.[0-9]*[1-9])?(e[-+][1-9][0-9]*)?/, 'tag:yaml.org,2002:float'],
]);

export const coreSchema = new PredicateSchema([
  ['null', 'tag:yaml.org,2002:null'],
  ['Null', 'tag:yaml.org,2002:null'],
  ['NULL', 'tag:yaml.org,2002:null'],
  ['~', 'tag:yaml.org,2002:null'],
  ['', 'tag:yaml.org,2002:null'],
  ['true', 'tag:yaml.org,2002:bool'],
  ['True', 'tag:yaml.org,2002:bool'],
  ['TRUE', 'tag:yaml.org,2002:bool'],
  ['false', 'tag:yaml.org,2002:bool'],
  ['False', 'tag:yaml.org,2002:bool'],
  ['FALSE', 'tag:yaml.org,2002:bool'],
  [/[-+]?[0-9]+/, 'tag:yaml.org,2002:int'],
  [/0o[0-7]+/, 'tag:yaml.org,2002:int'],
  [/0x[0-9a-fA-F]+/, 'tag:yaml.org,2002:int'],
  [/[-+]?(\.[0-9]+|[0-9]+(\.[0-9]*)?)([eE][-+]?[0-9]+)?/, 'tag:yaml.org,2002:float'],
  ['.inf', 'tag:yaml.org,2002:float'],
  ['.Inf', 'tag:yaml.org,2002:float'],
  ['.INF', 'tag:yaml.org,2002:float'],
  ['-.inf', 'tag:yaml.org,2002:float'],
  ['-.Inf', 'tag:yaml.org,2002:float'],
  ['-.INF', 'tag:yaml.org,2002:float'],
  ['.nan', 'tag:yaml.org,2002:float'],
  ['.NaN', 'tag:yaml.org,2002:float'],
  ['.NAN', 'tag:yaml.org,2002:float'],
  [/.*/, 'tag:yaml.org,2002:str'],
]);
