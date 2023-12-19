import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import { streamToEvents } from './streamToEvents';
import { streamToAst } from './streamToAst';
import { runTestSuite } from './runTestSuite';
import { evaluateStream } from './evaluate';
import { roundtrip } from './roundtrip';
import { validatorTypes } from './validatorTypes';
import { runEvaluationTests } from './runEvaluationTests';
import { runValidationTests } from './runValidationTests';
import { runPresentTests } from './runPresentTests';

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
    'evaluate <filename>',
    '',
    yargs => yargs
      .positional('filename', { type: 'string', demandOption: true }),
    args => evaluateStream(args.filename),
  )
  .command(
    'roundtrip <filename>',
    '',
    yargs => yargs
      .positional('filename', { type: 'string', demandOption: true }),
    args => roundtrip(args['filename']),
  )
  .command(
    'validator-types <filename>',
    '',
    yargs => yargs
      .positional('filename', { type: 'string', demandOption: true }),
    args => validatorTypes(args),
  )
  .command(
    'run-test-suite <test-suite-path> [test-name..]',
    '',
    yargs => yargs
      .positional('test-suite-path', { type: 'string', demandOption: true })
      .positional('test-name', { type: 'string', array: true, demandOption: true })
      .option('verbose', { type: 'boolean', default: false }),
    args => runTestSuite(args['test-suite-path'], args['test-name'], args.verbose),
  )
  .command(
    'run-evaluation-tests [test-name..]',
    '',
    yargs => yargs
      .positional('test-name', { type: 'string', array: true, demandOption: true }),
    args => runEvaluationTests(args['test-name']),
  )
  .command(
    'run-validation-tests [test-name..]',
    '',
    yargs => yargs
      .positional('test-name', { type: 'string', array: true, demandOption: true }),
    args => runValidationTests(args),
  )
  .command(
    'run-present-tests [test-name..]',
    '',
    yargs => yargs
      .positional('test-name', { type: 'string', array: true, demandOption: true }),
    args => runPresentTests(args['test-name']),
  )
  .parse();
