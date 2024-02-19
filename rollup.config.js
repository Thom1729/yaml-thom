import ts from 'rollup-plugin-ts';
import shebang from 'rollup-plugin-add-shebang';
import executable from 'rollup-plugin-executable-output';
import { string } from 'rollup-plugin-string';

const manualChunks = {
  nodes: ['src/nodes/index.ts'],
  util: ['src/util/index.ts'],
};

export default [
  {
    input: ['src/index.ts', 'src/helpers.ts'],
    output: [
      {
        dir: 'dist/esm',
        format: 'esm',
        manualChunks,
      },
      {
        dir: 'dist/cjs',
        format: 'cjs',
        manualChunks,
      },
    ],
    plugins: [
      string({
        include: '**/*.yaml',
      }),
      ts({}),
    ],
  },
  {
    external: [
      'yargs',
      'yargs/helpers',
      'chalk',

      'fs',
      'path',
      'url',
      'util',
    ],
    input: 'bin/cli.ts',
    output: [
      {
        file: 'dist-bin/cli.js',
        format: 'esm',
      },
    ],
    plugins: [
      string({
        include: '**/*.yaml',
      }),
      ts({
        tsconfig: config => ({
          ...config,
          declaration: false,
        }),
      }),
      shebang({
        shebang: '#!/usr/bin/env node',
      }),
      executable(),
    ],
  },
];
