import yargs from 'yargs';
import { loadOpenAPIDocument } from './openapi-loader';

const argv = yargs
  .usage('Usage: $0 [options] [filename]')
  .example('$0 -e utf8 openapi.json', 'run the program on the given file assuming utf8 encoding')
  .option('e', {
    alias: 'encoding',
    default: 'utf8',
    describe: 'the encoding of the file to be read',
    type: 'string'
  })
  .demandCommand(1).argv;

loadOpenAPIDocument(argv._[0], argv.e)
  .then(result => {
    console.log(result.paths);
  })
  .catch(error => console.error(error));
