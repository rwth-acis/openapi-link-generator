import fs from 'fs';
import oasValidator from 'oas-validator';
import { OpenAPIV3 } from 'openapi-types';
import Swagger2OpenAPI from 'swagger2openapi';
import util from 'util';

/**
 * Converts a documentation to valid OpenAPI 3.0 and validates its correctness.
 * @param content The Swagger/OpenAPI document as string (JSON/YAML)
 */
export async function parseOpenAPIDocument(content: string): Promise<OpenAPIV3.Document> {
  console.log(`Parsing Swagger/OpenAPI document`);

  // This not only converts the documentation to OpenAPI 3.0 but also resolves all $refs so that
  // they point to the schema object.
  const oas = await Swagger2OpenAPI.convertStr(content, {
    direct: true, // Return the openapi-object
    resolve: true, // We need to enable this in order for resolveInternal to work
    resolveInternal: true // Resolve internal $refs to object references
  });

  const result = await oasValidator.validate(oas, {});
  if (!result.valid) {
    throw new Error('Failed to validate the Swagger/OpenAPI document');
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
  console.log(`Reading file '${filename}' with encoding ${encoding}`);

  const fileContent = await util.promisify(fs.readFile)(filename, { encoding });
  return await parseOpenAPIDocument(fileContent);
}
