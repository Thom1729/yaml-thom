import { inspect } from 'util';
import { repeat } from '../src/util';
import chalk from 'chalk';

export class Logger {
  stream: NodeJS.WriteStream;

  level = 0;
  indent = '  ';
  bol = true;

  constructor(stream: NodeJS.WriteStream) {
    this.stream = stream;
  }

  write(s: string) {
    if (s.length === 0) return;

    const indentation = repeat(this.level, this.indent);
    if (this.bol) this.stream.write(indentation);
    this.stream.write(s.replace(/\n(?!$)/g, '\n' + indentation));
    this.bol = s.endsWith('\n');
  }

  log(...values: unknown[]) {
    this.write(values.map(stringify).join(' ') + '\n');
  }

  logCode(code: string) {
    for (const line of code.split(/^/gm)) {
      const replaced = line
        .replace(/ /g, '␣')
        .replace(/\n|$/, s => s.length ? '↵' : '∎')
      ;
      this.write(chalk.green(replaced + '\n'));
    }
  }

  indented(callback: () => void) {
    const priorIndent = this.level;
    this.level++;
    try {
      callback();
    } finally {
      this.level = priorIndent;
    }
  }
}

function stringify(value: unknown) {
  if (typeof value === 'string') {
    return value;
  } else {
    return inspect(value);
  }
}
