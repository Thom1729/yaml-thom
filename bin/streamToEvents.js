#!/usr/bin/env node

import { readFileSync } from 'fs';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import { parseStream, serializationTreeToEvents, stringifyEvent } from '../dist/esm/index.js';

yargs(hideBin(process.argv))
  .option('yaml-version', {
    alias: 'y',
    describe: 'YAML version',
    type: 'string',
    choices: ['1.2', '1.3'],
    default: '1.2',
  })
  .command(
    '* <filename>', '',
    yargs => yargs.positional('filename', { type: 'string' }),
    ({ filename, 'yaml-version': version }) => {
      const text = readFileSync(filename, { encoding: 'utf-8' });

      for (const event of serializationTreeToEvents(parseStream(text, { version }))) {
        console.log(stringifyEvent(event));
      }
    }
  )
  .argv;
