import { parseOpenAPIDocument } from './openapi-loader';

const oai1 = `
{
  "openapi": "3.0.0",
  "info": {
    "title": "Requirements Bazaar",
    "version": "0.6",
  },
  "paths": {
    "/create": {
      "post": {
        "summary": "This method creates sth.",
        "operationId": "create",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/TestObject"
              }
            }
          },
          "required": true
        },
        "responses": {
          "201": {
            "description": "Returns the created attachment",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/TestObject"
                }
              }
            }
          },
          "500": {
            "description": "Internal server problems"
          }
        }
      }
    }
  },
  "components": {
    "schemas": {
      "User": {
        "type": "object",
        "properties": {
          "id": {
            "type": "integer",
            "format": "int32"
          },
          "userName": {
            "type": "string"
          },
          "emailLeadSubscription": {
            "type": "boolean",
            "default": false
          }
        }
      },
      "TestObject": {
        "type": "object",
        "properties": {
          "id": {
            "type": "integer",
            "format": "int32"
          },
          "name": {
            "type": "string"
          },
          "creator": {
            "$ref": "#/components/schemas/User"
          },
          "creationDate": {
            "type": "string",
            "format": "date-time"
          }
        }
      }
    }
  }
}
`;

const swagger1 = `
swagger: '2.0'
info:
  title: Test API
  version: '1'
paths:
  '/create':
    post:
      summary: This method creates sth.
      operationId: create
      consumes:
        - application/json
      produces:
        - application/json
      parameters:
        - in: body
          name: body
          required: true
          schema:
            '$ref': '#/definitions/TestObject'
      responses:
        '201':
          description: Returns the created TestObject
          schema:
            '$ref': '#/definitions/TestObject'
        '500':
          description: Internal server problems
definitions:
  TestObject:
    type: object
    properties:
      id:
        type: integer
        format: int32
      name:
        type: string
      creationDate:
        type: string
        format: date-time
      creator:
        '$ref': '#/definitions/User'
  User:
    type: object
    properties:
      id:
        type: integer
        format: int32
      userName:
        type: string
      emailLeadSubscription:
        type: boolean
        default: false
`;

describe('parseOpenAPIDocument', () => {
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

    // Check that we have a ResponseObject, not a ReferenceObject (references should be resolved)
    const responseObj = doc.paths['/create'].post.responses['201'];
    if (!('description' in responseObj)) {
      throw new Error('Reference to component not resolved');
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

    // Check that the components reference is resolved to the same object
    expect(responseObj.content['application/json'].schema).toStrictEqual(doc.components.schemas.TestObject);
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

    // Check that we have a ResponseObject, not a ReferenceObject (references should be resolved)
    const responseObj = doc.paths['/create'].post.responses['201'];
    if (!('description' in responseObj)) {
      throw new Error('Reference to component not resolved');
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

    // Check that the components reference is resolved to the same object
    expect(responseObj.content['application/json'].schema).toStrictEqual(doc.components.schemas.TestObject);
  });
});
