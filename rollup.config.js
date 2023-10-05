import ts from 'rollup-plugin-ts';
import shebang from 'rollup-plugin-add-shebang';
import executable from 'rollup-plugin-executable-output';

export default [
  {
    input: 'src/index.ts',
    output: [
      {
        file: 'dist/esm/index.js',
        format: 'esm',
      },
      {
        file: 'dist/cjs/index.js',
        format: 'cjs',
      },
    ],
    plugins: [
      ts({}),
    ],
  },
  {
    external: [
      '../dist/esm/index.js',

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
