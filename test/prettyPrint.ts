import type { SerializationNode, SerializationValueNode, RepresentationNode }  from '@/nodes';

import chalk from 'chalk';

class PrettyPrinter {
  write: (string: string) => void;

  constructor(write: (string: string) => void) {
    this.write = write;
  }

  line(level: number) {
    this.write('\n');
    for (let i = 0; i < level; i++) {
      this.write('  ');
    }
  }

  prettyPrint(
    node: SerializationNode | RepresentationNode,
    level: number = 0,
    seen: Map<SerializationNode | RepresentationNode, string>,
  ) {
    if (seen.get(node)) {
      this.write('…');
      return;
    } else {
      seen.set(node, 'a');
    }

    if (node.kind === 'alias') {
      this.write(chalk.magenta('*' + node.alias));
      return;
    }

    const anchor = (node as SerializationValueNode).anchor;
    if (anchor !== null && anchor !== undefined) {
      this.write(chalk.magenta('&' + anchor));
      this.write(' ');
    }

    this.write(chalk.yellow(node.kind));

    if (node.tag !== null) {
      this.write(chalk.gray('<'));
      if (typeof node.tag === 'symbol') {
        this.write(chalk.cyan(node.tag.description));
      } else {
        this.write(chalk.blueBright(node.tag));
      }
      this.write(chalk.gray('>'));
    }

    if (node.kind === 'scalar') {
      this.write(' ');
      this.write(chalk.green(JSON.stringify(node.content)));
    } else if (node.kind === 'sequence') {
      for (const item of node.content) {
        this.line(level);
        this.write(chalk.gray('- '));
        this.prettyPrint(item, level + 1, seen);
      }
    } else if (node.kind === 'mapping') {
      for (const [key, value] of node.content) {
        this.line(level);
        this.write(chalk.gray('? '));
        this.prettyPrint(key, level + 1, seen);

        this.line(level);
        this.write(chalk.gray(': '));
        this.prettyPrint(value, level + 1, seen);
      }
    }

    if (level === 0) {
      this.write('\n');
    }
  }
}

export function prettyPrint(
  write: (string: string) => void,
  node: SerializationNode | RepresentationNode
) {
  new PrettyPrinter(write).prettyPrint(node, 0, new Map());
}
