import fs from 'fs';
import log from 'loglevel';
import oasValidator from 'oas-validator';
import { OpenAPIV3 } from 'openapi-types';
import Swagger2OpenAPI from 'swagger2openapi';
import util from 'util';
import yaml from 'yaml';

/**
 * For a Swagger 2.0 documentation it converts it to valid OpenAPI 3.0.
 * For an OpenAPI 3.0 documentation it validates its correctness.
 * @param content The Swagger/OpenAPI document as string (JSON/YAML)
 */
export async function parseOpenAPIDocument(content: string): Promise<OpenAPIV3.Document> {
  log.debug('Parsing Swagger/OpenAPI document');

  // This loads the documentation and converts it to OpenAPI 3.0 if needed.
  // $refs are not resolved.
  const oas = await Swagger2OpenAPI.convertStr(content, {
    direct: true // Return the openapi-object directly
  });

  log.debug('Validating OpenAPI 3.0 document');
  const result = await oasValidator.validate(oas, {});
  if (!result.valid) {
    throw new Error('Failed to validate the OpenAPI document');
  }

  // Because of the validation we know that oas is an OpenAPIV3.Document
  return oas;
}

/**
 * Loads a documentation, converts it to valid OpenAPI 3.0 and validates its correctness.
 * @param filename The file to be loaded
 * @param encoding The encoding of the file
 */
export async function loadOpenAPIDocument(filename: string, encoding: string): Promise<OpenAPIV3.Document> {
  log.debug(`Reading file '${filename}' with encoding ${encoding}`);

  const fileContent = await util.promisify(fs.readFile)(filename, { encoding });
  return await parseOpenAPIDocument(fileContent);
}

/**
 * Writes an OpenAPI document to a file.
 * It is important that the document contains no circular references.
 * @param document The OpenAPI document to write
 * @param filename The name of the file to write to
 * @param format Whether to export YAML or JSON
 * @param encoding Encoding of the file
 */
export function saveOpenAPIDocument(document: OpenAPIV3.Document, filename: string, format: 'yaml' | 'json', encoding: string) {
  log.debug(`Writing file ${filename} with encoding ${encoding}`);
  return util.promisify(fs.writeFile)(filename, format === 'yaml' ? yaml.stringify(document) : JSON.stringify(document), { encoding });
}
