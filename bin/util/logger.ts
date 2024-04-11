import { inspect, type InspectOptions, type InspectOptionsStylized } from 'util';
import chalk from 'chalk';

import {
  RepresentationScalar, RepresentationSequence, RepresentationMapping,
  type RepresentationNode,
} from '@/index';

const INVISIBLES = {
  ' ': '·',
  '\n': '↵',
};

const INVISIBLES_EXPR = new RegExp(String.raw`(?:${Object.keys(INVISIBLES).join('|')})`, 'gu');

export function repeat(count: number, s: string) {
  return new Array(count + 1).join(s);
}

function inspectNode(
  this: RepresentationNode,
  depth: number,
  opts: InspectOptionsStylized,
  recurse: typeof inspect,
) {
  const type = opts.stylize(this.constructor.name, 'special');
  const tag = opts.stylize(this.tag, 'string');
  const content: unknown = this.kind === 'scalar' ? this.content : Array.from(this as any);

  return `${type}<${tag}> ${recurse(content, opts)}`;
}

for (const cls of [RepresentationScalar, RepresentationSequence, RepresentationMapping]) {
  Object.defineProperty(cls.prototype, inspect.custom, { value: inspectNode });
}

const DEFAULT_OPTIONS = {
  depth: Infinity,
  colors: true,
} satisfies InspectOptions;

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

  dir(value: unknown, options?: InspectOptions) {
    this.write(inspect(value, { ...DEFAULT_OPTIONS, ...options }) + '\n');
  }

  logCode(code: string) {
    for (const line of code.split(/^/gm)) {
      const replaced = line
        .replace(INVISIBLES_EXPR, c => chalk.dim(INVISIBLES[c as keyof typeof INVISIBLES]))
      ;
      this.write(chalk.green(replaced + (line.endsWith('\n') ? '' : '∎') + '\n'));
    }
  }

  indented(callback: () => Promise<void>): Promise<void>;
  indented(callback: () => void): void;

  async indented(callback: () => void | Promise<void>) {
    const priorIndent = this.level;
    this.level++;
    try {
      const result = callback();
      if (isThenable(result)) await result;
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

type Thenable = {
  then: (...args: never[]) => unknown;
};

function isThenable(value: unknown): value is Thenable {
  return (
    value !== null
    && typeof value === 'object'
    && 'then' in value
    && typeof value.then === 'function'
  );
}
