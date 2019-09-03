#!/usr/bin/env node
import log from 'loglevel';
import yargs from 'yargs';
import addLinkDefinitions from './link-generator';
import { loadOpenAPIDocument, saveOpenAPIDocument, serializeOpenAPIDocument } from './openapi-tools';

const argv = yargs
  .usage('Usage: $0 [options] [filename]')
  .example('$0 -e utf8 openapi.json', 'Run the program on the given file assuming utf8 encoding')
  .option('e', {
    alias: 'encoding',
    default: 'utf8',
    describe: 'The encoding of the file to be read',
    type: 'string'
  })
  .option('l', {
    alias: 'log-level',
    choices: ['error', 'warn', 'info', 'debug', 'trace'],
    default: 'warn',
    describe: 'Set the log level'
  })
  .option('o', {
    alias: 'output',
    describe: 'Set the output filename or unset to output to the console',
    type: 'string'
  })
  .option('f', {
    alias: 'format',
    choices: ['yaml', 'json'],
    default: 'json',
    describe: 'Set the output format'
  })
  .demandCommand(1).argv;

// This type cast is safe because we specified those choices to yargs
const loglevel = argv.l as 'error' | 'warn' | 'info' | 'debug' | 'trace';
log.setLevel(loglevel);

loadOpenAPIDocument(argv._[0], argv.e)
  .then(addLinkDefinitions)
  .then(result => {
    if (argv.o != null) {
      saveOpenAPIDocument(result.oas, argv.o, argv.f as 'yaml' | 'json', argv.e);
    } else {
      console.log(serializeOpenAPIDocument(result.oas, argv.f as 'yaml' | 'json'));
    }
  })
  .catch(error => console.error(error));
