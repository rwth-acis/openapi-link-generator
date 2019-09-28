#!/usr/bin/env node
import log from 'loglevel';
import yargs from 'yargs';
import { version } from '../package.json';
import { addLinkDefinitions } from './link-generator';
import { loadOpenAPIDocument, saveOpenAPIDocument, serializeOpenAPIDocument } from './openapi-tools';

const argv = yargs
  .usage('Usage: $0 [options] [filename]')
  .example('$0 -e utf8 openapi.json', 'Run the program on the given file assuming utf8 encoding')
  .option('e', {
    alias: 'encoding',
    default: 'utf8',
    describe: 'The encoding used to read and write files',
    type: 'string'
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
  .option('v', {
    alias: 'verbose',
    default: false,
    describe: 'Enable verbose logging',
    type: 'boolean'
  })
  .version(version)
  .demandCommand(1).argv;

if (argv.o == null) {
  log.setLevel('error');
} else {
  log.setLevel(argv.v ? 'debug' : 'info');
}

log.info(`Link Generator v${version}`);
log.info('Copyright (c) 2019 Advanced Community Information Systems');
log.info();

loadOpenAPIDocument(argv._[0], argv.e)
  .then(addLinkDefinitions)
  .then(result => {
    if (argv.o != null) {
      saveOpenAPIDocument(result.openapi, argv.o, argv.f as 'yaml' | 'json', argv.e);
    } else {
      console.log(serializeOpenAPIDocument(result.openapi, argv.f as 'yaml' | 'json'));
    }
  })
  .catch(error => log.error(error));
