import fs from 'fs';
import log from 'loglevel';
import oasValidator from 'oas-validator';
import { OpenAPIV3 } from 'openapi-types';
import Swagger2OpenAPI from 'swagger2openapi';
import util from 'util';
import yaml from 'yaml';

log.setDefaultLevel('error');

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
  log.debug(`Writing file '${filename}' with encoding ${encoding}`);
  return util.promisify(fs.writeFile)(filename, serializeOpenAPIDocument(document, format), { encoding });
}

/**
 * Takes the parts of a Json Pointer and serialized them into a string according to the
 * JSON Reference specification.
 *
 * Example:
 *   Input  ['components', '/parts']
 *   Output '/components/~1parts'
 * @param input The path elements of the Json Pointer
 */
export function serializeJsonPointer(input: string[]): string {
  if (input.length === 0) {
    return '/';
  }
  return input
    .map(str => str.replace(/~/g, '~0').replace(/\//g, '~1'))
    .reduce((prev, curr) => (prev += '/' + curr), '');
}

/**
 * Takes a serialized Json Pointer as input and parses it into its path parts.
 *
 * Example:
 *   Input  '/components/~1parts'
 *   Output ['components', '/parts']
 * @param input The Json Pointer to be parsed
 */
export function parseJsonPointer(input: string): string[] {
  if (!input.startsWith('/')) {
    throw new Error(`Cannot parse JSON Pointer: ${input}\JSON Pointers must start with a forward-slash.`);
  }
  return input
    .split('/')
    .slice(1)
    .map(str => str.replace(/~1/g, '/').replace(/~0/g, '~'))
    .filter(str => str.length > 0);
}

/**
 * Checks if a reference object is a reference to an internal or an external object.
 * Return true for an external and false for an internal reference
 * @param reference The reference object to check
 */
export function isExternalRef(reference: OpenAPIV3.ReferenceObject): boolean {
  return !reference.$ref.startsWith('#');
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
  if (isExternalRef(reference)) {
    throw new Error(`Resolving external references is not supported: ${reference.$ref}`);
  }
  const ref = parseJsonPointer(reference.$ref.substring(1));
  if (ref.length !== 3 || ref[0] !== 'components') {
    throw new Error(`Invalid component referernce: ${reference.$ref}`);
  }

  if (document.components == null) {
    throw new Error(`Could not resolve reference: ${reference.$ref}`);
  }

  if (type !== ref[1]) {
    throw new Error(`Invalid reference type: expected ${type}, got ${ref[1]}`);
  }

  switch (type) {
    case 'parameters': {
      if (document.components.parameters == null || !(ref[2] in document.components.parameters)) {
        throw new Error(`Could not resolve parameter reference: ${reference.$ref}`);
      }

      const obj = document.components.parameters[ref[2]];
      if ('$ref' in obj) {
        return resolveComponentRef(document, obj, type);
      } else {
        return obj;
      }
    }
    case 'schemas': {
      if (document.components.schemas == null || !(ref[2] in document.components.schemas)) {
        throw new Error(`Could not resolve schema reference: ${reference.$ref}`);
      }

      const obj = document.components.schemas[ref[2]];
      if ('$ref' in obj) {
        return resolveComponentRef(document, obj, type);
      } else {
        return obj;
      }
    }
    case 'responses': {
      if (document.components.responses == null || !(ref[2] in document.components.responses)) {
        throw new Error(`Could not resolve response reference: ${reference.$ref}`);
      }

      const obj = document.components.responses[ref[2]];
      if ('$ref' in obj) {
        return resolveComponentRef(document, obj, type);
      } else {
        return obj;
      }
    }
  }
}

/**
 * Names for keys of objects in the components-section as well as names for links must adhere to the regular expression
 * ^[a-zA-Z0-9\.\-_]+$ according to the OpenAPI specification. We replace all other characters with underscores.
 * https://github.com/OAI/OpenAPI-Specification/blob/master/versions/3.0.2.md#componentsObject
 * @param componentName The component name to be sanitized
 */
export function sanitizeComponentName(componentName: string): string {
  const regex = /[^a-zA-Z0-9\.\-_]/g;
  if (componentName.length === 0) {
    throw new Error('The component name must not be empty');
  }
  return componentName.replace(regex, '_');
}
