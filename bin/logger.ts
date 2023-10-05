import { inspect } from 'util';
import chalk from 'chalk';

const INVISIBLES = {
  ' ': '·',
  '\n': '↵',
};

const INVISIBLES_EXPR = new RegExp(String.raw`(?:${Object.keys(INVISIBLES).join('|')})`, 'gu');

export function repeat(count: number, s: string) {
  return new Array(count + 1).join(s);
}

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
    this.stream.write(s.replace(/\n(?!$)/gm, '\n' + indentation));
    this.bol = s.endsWith('\n');
  }

  log(...values: unknown[]) {
    this.write(values.map(stringify).join(' ') + '\n');
  }

  logCode(code: string) {
    for (const line of code.split(/^/gm)) {
      const replaced = line
        .replace(INVISIBLES_EXPR, c => chalk.dim(INVISIBLES[c as keyof typeof INVISIBLES]))
      ;
      this.write(chalk.green(replaced + (line.endsWith('\n') ? '' : '∎') + '\n'));
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
