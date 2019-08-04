import fs from 'fs';
import sw2oai from 'swagger2openapi';
import util from 'util';
import yaml from 'yaml';
import yargs from 'yargs';
import { OpenAPIObject, SwaggerObject } from './openapi';

const swagger2openapi = util.promisify(sw2oai.convertObj);

const argv = yargs
  .usage('Usage: $0 [options] [filename]')
  .example('$0 -e utf8 openapi.json', 'run the program on the given file assuming utf8 encoding')
  .option('e', {
    alias: 'encoding',
    default: 'utf8',
    describe: 'the encoding of the file to be read',
    type: 'string',
  })
  .demandCommand(1)
  .argv;

async function loadOpenAPIDocumentation(): Promise<OpenAPIObject> {
  let content: string;
  const filename = argv._[0];
  console.log(`Opening file: ${filename}`);
  try {
    content = fs.readFileSync(filename, argv.e);
  } catch {
    throw new Error(`Unable to read file '${filename}'`);
  }

  let oas: OpenAPIObject | SwaggerObject | any;
  try {
    oas = JSON.parse(content);
  } catch {
    try {
      oas = yaml.parse(content);
    } catch {
      throw new Error('Unable to parse JSON/YAML file');
    }
  }

  if ('openapi' in oas) {
    if (/^3\.0\.\d$/.test(oas.openapi)) {
      console.log('OpenAPI 3.0.x documentation detected');
    } else {
      throw new Error(`This version of OpenAPI is currently unsupported: ${oas.openapi}`);
    }
  } else if ('swagger' in oas) {
    if (oas.swagger === '2.0') {
      console.log('Swagger 2.0 documentation detected, converting to OpenAPI 3.0');
      oas = (await swagger2openapi(oas, {})).openapi;
    } else {
      throw new Error(`This version of Swagger is currently unsupported: ${oas.swagger}`);
    }
  } else {
    throw new Error(`No valid Swagger/OpenAPI documentation detected`);
  }

  return oas;
}

loadOpenAPIDocumentation();
