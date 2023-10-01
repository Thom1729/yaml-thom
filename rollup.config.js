import ts from 'rollup-plugin-ts';

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
];
