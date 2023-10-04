import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import { streamToEvents } from './someCommand';

yargs(hideBin(process.argv))
  .option('yaml-version', {
    alias: 'y',
    describe: 'YAML version',
    type: 'string',
    choices: ['1.2', '1.3'],
    default: '1.2',
  } as const)
  .command(
    'stream-to-events <filename>', '',
    yargs => yargs.positional('filename', { type: 'string' }),
    args => streamToEvents(args.filename!, args['yaml-version']),
  )
  .parse();
