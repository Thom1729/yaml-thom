import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import { streamToEvents } from './streamToEvents';
import { streamToAst } from './streamToAst';
import { runTestSuite } from './runTestSuite';

yargs(hideBin(process.argv))
  .option('yaml-version', {
    alias: 'y',
    describe: 'YAML version',
    type: 'string',
    choices: ['1.2', '1.3'],
    default: '1.2',
  } as const)
  .command(
    'stream-to-events <filename>',
    '',
    yargs => yargs
      .positional('filename', { type: 'string', demandOption: true }),
    args => streamToEvents(args.filename, args['yaml-version']),
  )
  .command(
    'stream-to-ast <filename>',
    '',
    yargs => yargs
      .positional('filename', { type: 'string', demandOption: true }),
    args => streamToAst(args.filename, args['yaml-version']),
  )
  .command(
    'run-test-suite <test-suite-path>',
    '',
    yargs => yargs
      .positional('test-suite-path', { type: 'string', demandOption: true })
      .option('verbose', { type: 'boolean', default: false }),
    args => runTestSuite(args['test-suite-path'], args.verbose),
  )
  .parse();
