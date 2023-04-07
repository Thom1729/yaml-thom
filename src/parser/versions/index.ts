import yaml_12 from './yaml_12';
import yaml_13 from './yaml_13';

import type { Grammar } from '../core/grammarType';
import type { NodeClasses } from '../core/astToSerializationTree';

export interface VersionInfo {
  grammar: Grammar,
  rootProduction: string,
  nodeClasses: NodeClasses,
}

export default {
  '1.2': yaml_12,
  '1.3': yaml_13,
} as const satisfies Record<string, VersionInfo>;
