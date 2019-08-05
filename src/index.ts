import log from 'loglevel';
import yargs from 'yargs';
import addLinkDefinitions from './link-generator';
import { loadOpenAPIDocument } from './openapi-tools';

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
  .demandCommand(1).argv;

// This type cast is safe because we specified those choices to yargs
const loglevel = argv.l as 'error' | 'warn' | 'info' | 'debug' | 'trace';
log.setLevel(loglevel);

loadOpenAPIDocument(argv._[0], argv.e)
  .then(addLinkDefinitions)
  .catch(error => console.error(error));
