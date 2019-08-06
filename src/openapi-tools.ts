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
 * Serialize the OpenAPI document in the given format
 * @param document The OpenAPI document
 * @param format The desired format
 */
export function serializeOpenAPIDocument(document: OpenAPIV3.Document, format: 'yaml' | 'json') {
  return format === 'yaml' ? yaml.stringify(document) : JSON.stringify(document);
}

/**
 * Writes an OpenAPI document to a file.
 * It is important that the document contains no circular references.
 * @param document The OpenAPI document to write
 * @param filename The name of the file to write to
 * @param format Whether to export YAML or JSON
 * @param encoding Encoding of the file
 */
export function saveOpenAPIDocument(
  document: OpenAPIV3.Document,
  filename: string,
  format: 'yaml' | 'json',
  encoding: string
) {
  log.debug(`Writing file ${filename} with encoding ${encoding}`);
  return util.promisify(fs.writeFile)(filename, serializeOpenAPIDocument(document, format), { encoding });
}

/**
 * Resolves a reference object that points internally to a component definition in the given OpenAPI document.
 * @param document The OpenAPIV3 document
 * @param reference The reference object to be resolved
 * @param type The expected type of the reference
 */
export function resolveComponentRef(
  document: OpenAPIV3.Document,
  reference: OpenAPIV3.ReferenceObject,
  type: 'parameters'
): OpenAPIV3.ParameterObject;
export function resolveComponentRef(
  document: OpenAPIV3.Document,
  reference: OpenAPIV3.ReferenceObject,
  type: 'schemas'
): OpenAPIV3.SchemaObject;
export function resolveComponentRef(
  document: OpenAPIV3.Document,
  reference: OpenAPIV3.ReferenceObject,
  type: 'responses'
): OpenAPIV3.ResponseObject;
export function resolveComponentRef(
  document: OpenAPIV3.Document,
  reference: OpenAPIV3.ReferenceObject,
  type: 'parameters' | 'schemas' | 'responses'
): OpenAPIV3.ParameterObject | OpenAPIV3.SchemaObject | OpenAPIV3.ResponseObject {
  const ref = reference.$ref;
  if (!ref.startsWith('#/components/')) {
    throw new Error(`Invalid components referernce: ${ref}`);
  }

  if (document.components == null) {
    throw new Error(`Could not resolve reference: ${ref}`);
  }

  const parts = ref.split('/').slice(2);
  if (type !== parts[0]) {
    throw new Error(`Invalid reference type: expected ${type}, got ${parts[0]}`);
  }

  switch (type) {
    case 'parameters': {
      if (document.components.parameters == null || !(parts[1] in document.components.parameters)) {
        throw new Error(`Could not resolve parameter reference: ${ref}`);
      }

      const obj = document.components.parameters[parts[1]];
      if ('$ref' in obj) {
        return resolveComponentRef(document, obj, type);
      } else {
        return obj;
      }
    }
    case 'schemas': {
      if (document.components.schemas == null || !(parts[1] in document.components.schemas)) {
        throw new Error(`Could not resolve schema reference: ${ref}`);
      }

      const obj = document.components.schemas[parts[1]];
      if ('$ref' in obj) {
        return resolveComponentRef(document, obj, type);
      } else {
        return obj;
      }
    }
    case 'responses': {
      if (document.components.responses == null || !(parts[1] in document.components.responses)) {
        throw new Error(`Could not resolve response reference: ${ref}`);
      }

      const obj = document.components.responses[parts[1]];
      if ('$ref' in obj) {
        return resolveComponentRef(document, obj, type);
      } else {
        return obj;
      }
    }
  }
}
