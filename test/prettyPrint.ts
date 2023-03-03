import type { SerializationNode as Node }  from '@/common/nodes';

import chalk from 'chalk';

class PrettyPrinter {
  write(string: string) {
    process.stdout.write(string);
  }

  line(level: number) {
    this.write('\n');
    for (let i = 0; i < level; i++) {
      this.write('  ');
    }
  }

  prettyPrint(node: Node, level: number = 0, seen: Map<Node, string>) {
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

    if (node.anchor !== undefined) {
      this.write(chalk.magenta('&' + node.anchor));
      this.write(' ');
    }

    this.write(chalk.yellow(node.kind));

    if (node.tag !== undefined) {
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

export function prettyPrint(node: Node, level: number = 0) {
  new PrettyPrinter().prettyPrint(node, level, new Map());
}
