import fs from 'fs';
import { OpenAPIV3 } from 'openapi-types';
import util from 'util';
import { loadOpenAPIDocument, parseOpenAPIDocument, resolveComponentRef } from '../src/openapi-tools';

describe('parseOpenAPIDocument', () => {
  let oai1: string;
  let swagger1: string;

  beforeEach(async () => {
    const rF = util.promisify(fs.readFile);
    oai1 = await rF('test/fixtures/openapi-minimal.json', { encoding: 'utf8' });
    swagger1 = await rF('test/fixtures/swagger-minimal.yaml', { encoding: 'utf8' });
  });

  it('should parse Swagger 2.0', async () => {
    const doc = await parseOpenAPIDocument(swagger1);

    // Check that the paths object contains the defined path and response
    expect(doc.paths).toBeTruthy();
    if (
      doc.paths['/create'] == null ||
      doc.paths['/create'].post == null ||
      doc.paths['/create'].post.responses == null ||
      doc.paths['/create'].post.responses['201'] == null
    ) {
      throw new Error('Paths are null');
    }

    // Check that we have content defined
    const responseObj = doc.paths['/create'].post.responses['201'];
    if (!('content' in responseObj)) {
      throw new Error('Response is missing content-field');
    }

    // Check the schema of the response object
    if (
      responseObj.content == null ||
      responseObj.content['application/json'] == null ||
      responseObj.content['application/json'].schema == null
    ) {
      throw new Error('Response definition is null');
    }

    // Check that the components reference is non-resolved. This is crucial to avoid circular dependencies.
    expect(responseObj.content['application/json'].schema).toStrictEqual({ $ref: '#/components/schemas/TestObject' });

    // Check that the schema component exists
    if (doc.components == null || doc.components.schemas == null || doc.components.schemas.TestObject == null) {
      throw new Error('Component definition is null');
    }

    // Check that the schema component has properties
    expect(doc.components.schemas.TestObject).toHaveProperty('type', 'object');
    expect(doc.components.schemas.TestObject).toHaveProperty('properties.id');
    expect(doc.components.schemas.TestObject).toHaveProperty('properties.name');
    expect(doc.components.schemas.TestObject).toHaveProperty('properties.creationDate');
    expect(doc.components.schemas.TestObject).toHaveProperty('properties.creator');
  });

  it('should parse OpenAPI 3.0', async () => {
    const doc = await parseOpenAPIDocument(oai1);

    // Check that the paths object contains the defined path and response
    expect(doc.paths).toBeTruthy();
    if (
      doc.paths['/create'] == null ||
      doc.paths['/create'].post == null ||
      doc.paths['/create'].post.responses == null ||
      doc.paths['/create'].post.responses['201'] == null
    ) {
      throw new Error('Paths are null');
    }

    // Check that we have content defined
    const responseObj = doc.paths['/create'].post.responses['201'];
    if (!('content' in responseObj)) {
      throw new Error('Response is missing content-field');
    }

    // Check the schema of the response object
    if (
      responseObj.content == null ||
      responseObj.content['application/json'] == null ||
      responseObj.content['application/json'].schema == null
    ) {
      throw new Error('Response definition is null');
    }

    // Check that the schema component exists
    if (doc.components == null || doc.components.schemas == null || doc.components.schemas.TestObject == null) {
      throw new Error('Component definition is null');
    }

    // Check that the components reference is non-resolved. This is crucial to avoid circular dependencies.
    expect(responseObj.content['application/json'].schema).toStrictEqual({ $ref: '#/components/schemas/TestObject' });

    // Check that the schema component has properties
    expect(doc.components.schemas.TestObject).toHaveProperty('type', 'object');
    expect(doc.components.schemas.TestObject).toHaveProperty('properties.id');
    expect(doc.components.schemas.TestObject).toHaveProperty('properties.name');
    expect(doc.components.schemas.TestObject).toHaveProperty('properties.creationDate');
    expect(doc.components.schemas.TestObject).toHaveProperty('properties.creator');
  });
});

describe('resolveComponentRef', () => {
  let doc: OpenAPIV3.Document;

  beforeEach(async () => {
    doc = await loadOpenAPIDocument('test/fixtures/openapi-components.json', 'utf8');
  });

  it('should resolve schema references', () => {
    const ref = resolveComponentRef(doc, { $ref: '#/components/schemas/User' }, 'schemas');
    expect(ref).toHaveProperty('properties.emailLeadSubscription');
  });

  it('should follow nested schema references', () => {
    const ref = resolveComponentRef(doc, { $ref: '#/components/schemas/SchemaReference' }, 'schemas');
    expect(ref).toHaveProperty('properties.emailLeadSubscription');
  });

  it('should resolve parameter references', () => {
    const ref = resolveComponentRef(doc, { $ref: '#/components/parameters/TestParameter' }, 'parameters');
    expect(ref).toHaveProperty('name', 'parameter');
  });

  it('should resolve nested parameter references', () => {
    const ref = resolveComponentRef(doc, { $ref: '#/components/parameters/ParameterReference' }, 'parameters');
    expect(ref).toHaveProperty('name', 'parameter');
  });

  it('should respect the type', () => {
    expect(() => resolveComponentRef(doc, { $ref: '#/components/schemas/SchemaReference' }, 'parameters')).toThrow();
    expect(() => resolveComponentRef(doc, { $ref: '#/components/parameters/TestParameter' }, 'schemas')).toThrow();
  });
});
