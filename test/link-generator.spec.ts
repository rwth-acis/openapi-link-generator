import oasValidator from 'oas-validator';
import { OpenAPIV3 } from 'openapi-types';
import { addLinkDefinitions } from '../src/link-generator';

describe('addLinkDefinitions', () => {
  describe('openapi-reqbaz.json', () => {
    let oas: OpenAPIV3.Document;

    beforeEach(() => {
      oas = require('./fixtures/openapi-reqbaz.json');
    });

    it('clones the oas-object', () => {
      const res = addLinkDefinitions(oas).openapi;
      expect(res).not.toBe(oas);
    });

    it('returns a valid oas', async () => {
      const res = addLinkDefinitions(oas).openapi;
      expect((await oasValidator.validate(res, {})).valid).toBe(true);
    });

    it('does not remove/overwrite any property', () => {
      const res = addLinkDefinitions(oas).openapi;

      const catResponses = ((res.paths['/categories/{categoryId}'] as OpenAPIV3.PathItemObject)
        .get as OpenAPIV3.OperationObject).responses as OpenAPIV3.ResponsesObject;
      delete (catResponses['200'] as OpenAPIV3.ResponseObject).links;
      delete (catResponses['203'] as OpenAPIV3.ResponseObject).links;
      delete ((((res.paths['/projects/{projectId}'] as OpenAPIV3.PathItemObject).get as OpenAPIV3.OperationObject)
        .responses as OpenAPIV3.ResponsesObject)['200'] as OpenAPIV3.ResponseObject).links;
      delete ((((res.paths['/requirements/{requirementId}'] as OpenAPIV3.PathItemObject)
        .get as OpenAPIV3.OperationObject).responses as OpenAPIV3.ResponsesObject)['200'] as OpenAPIV3.ResponseObject)
        .links;
      delete (res.components as OpenAPIV3.ComponentsObject).links;

      expect(res).toStrictEqual(oas);
    });

    it('adds the desired link definitions', () => {
      const res = addLinkDefinitions(oas).openapi;

      const catExpected = {
        contributors: {
          $ref: '#/components/links/contributors'
        },
        followers: {
          $ref: '#/components/links/followers'
        },
        requirements: {
          $ref: '#/components/links/requirements'
        },
        statistics: {
          $ref: '#/components/links/statistics'
        }
      };
      const catResponses = ((res.paths['/categories/{categoryId}'] as OpenAPIV3.PathItemObject)
        .get as OpenAPIV3.OperationObject).responses as OpenAPIV3.ResponsesObject;
      expect((catResponses['200'] as OpenAPIV3.ResponseObject).links).toStrictEqual(catExpected);
      expect((catResponses['203'] as OpenAPIV3.ResponseObject).links).toStrictEqual(catExpected);

      expect(
        ((((res.paths['/projects/{projectId}'] as OpenAPIV3.PathItemObject).get as OpenAPIV3.OperationObject)
          .responses as OpenAPIV3.ResponsesObject)['200'] as OpenAPIV3.ResponseObject).links
      ).toStrictEqual({
        categories: {
          description: expect.any(String),
          operationRef: '#/paths/~1projects~1{projectId}~1categories/get',
          parameters: {
            projectId: '$request.path.projectId'
          }
        },
        contributors: {
          description: expect.any(String),
          operationId: 'getContributorsForProject',
          parameters: {
            projectId: '$request.path.projectId'
          }
        },
        followers: {
          description: expect.any(String),
          operationId: 'getFollowersForProject',
          parameters: {
            projectId: '$request.path.projectId'
          }
        },
        requirements: {
          description: expect.any(String),
          operationId: 'getRequirementsForProject',
          parameters: {
            projectId: '$request.path.projectId'
          }
        },
        statistics: {
          description: expect.any(String),
          operationId: 'getStatisticsForProject',
          parameters: {
            projectId: '$request.path.projectId'
          }
        }
      });

      expect(
        ((((res.paths['/requirements/{requirementId}'] as OpenAPIV3.PathItemObject).get as OpenAPIV3.OperationObject)
          .responses as OpenAPIV3.ResponsesObject)['200'] as OpenAPIV3.ResponseObject).links
      ).toStrictEqual({
        attachments: {
          description: expect.any(String),
          operationId: 'getAttachmentsForRequirement',
          parameters: {
            requirementId: '$request.path.requirementId'
          }
        },
        comments: {
          description: expect.any(String),
          operationId: 'getCommentsForRequirement',
          parameters: {
            requirementId: '$request.path.requirementId'
          }
        },
        contributors: {
          description: expect.any(String),
          operationId: 'getContributorsForRequirement',
          parameters: {
            requirementId: '$request.path.requirementId'
          }
        },
        developers: {
          description: expect.any(String),
          operationId: 'getDevelopersForRequirement',
          parameters: {
            requirementId: '$request.path.requirementId'
          }
        },
        followers: {
          description: expect.any(String),
          operationId: 'getFollowersForRequirement',
          parameters: {
            requirementId: '$request.path.requirementId'
          }
        },
        statistics: {
          description: expect.any(String),
          operationId: 'getStatisticsForRequirement',
          parameters: {
            requirementId: '$request.path.requirementId'
          }
        }
      });

      expect((res.components as OpenAPIV3.ComponentsObject).links).toStrictEqual({
        contributors: {
          description: expect.any(String),
          operationId: 'getContributorsForCategory',
          parameters: {
            categoryId: '$request.path.categoryId'
          }
        },
        followers: {
          description: expect.any(String),
          operationId: 'getFollowersForCategory',
          parameters: {
            categoryId: '$request.path.categoryId'
          }
        },
        requirements: {
          description: expect.any(String),
          operationId: 'getRequirementsForCategory',
          parameters: {
            categoryId: '$request.path.categoryId'
          }
        },
        statistics: {
          description: expect.any(String),
          operationId: 'getStatisticsForCategory',
          parameters: {
            categoryId: '$request.path.categoryId'
          }
        }
      });
    });

    it('does not overwrite existing links', () => {
      const attLink = {
        description: 'Test description',
        operationId: 'abc',
        parameters: {
          requirementId: 'defg'
        }
      };

      ((((oas.paths['/requirements/{requirementId}'] as OpenAPIV3.PathItemObject).get as OpenAPIV3.OperationObject)
        .responses as OpenAPIV3.ResponsesObject)['200'] as OpenAPIV3.ResponseObject).links = {
        attachments: attLink
      };

      const res = addLinkDefinitions(oas).openapi;
      expect(
        ((((res.paths['/requirements/{requirementId}'] as OpenAPIV3.PathItemObject).get as OpenAPIV3.OperationObject)
          .responses as OpenAPIV3.ResponsesObject)['200'] as OpenAPIV3.ResponseObject).links
      ).toMatchObject({
        attachments: attLink
      });
    });

    it('does not overwrite existing link components', () => {
      const link = {
        description: 'Test description',
        operationId: 'def',
        parameters: {
          categoryId: 'fed'
        }
      };

      (oas.components as OpenAPIV3.ComponentsObject).links = {
        contributors: link
      };

      const res = addLinkDefinitions(oas).openapi;
      expect((res.components as OpenAPIV3.ComponentsObject).links).toMatchObject({
        contributors: link
      });
    });
  });

  it('does detect path extension instead of substring', () => {
    const oasSubstring = require('./fixtures/openapi-substring.json');
    // Paths of the form /A and /A/B should be linked. Paths of the form /A, /AB not.
    expect(addLinkDefinitions(oasSubstring).openapi).toStrictEqual(oasSubstring);
  });

  it('handles external references', () => {
    const oas = require('./fixtures/openapi-external-reference.json') as OpenAPIV3.Document;
    const res = addLinkDefinitions(oas).openapi;

    expect(
      ((((res.paths['/get'] as OpenAPIV3.PathItemObject).get as OpenAPIV3.OperationObject)
        .responses as OpenAPIV3.ResponsesObject)['200'] as OpenAPIV3.ResponseObject).links
    ).toMatchObject({
      parameterless: {
        operationId: 'getparameterless',
        parameters: {}
      }
    });
  });

  it('handles duplicate parameter and schema definitions', () => {
    const oas = require('./fixtures/openapi-duplicate-schema.json') as OpenAPIV3.Document;
    const res = addLinkDefinitions(oas).openapi;

    expect(
      ((((res.paths['/get'] as OpenAPIV3.PathItemObject).get as OpenAPIV3.OperationObject)
        .responses as OpenAPIV3.ResponsesObject)['200'] as OpenAPIV3.ResponseObject).links
    ).toMatchObject({
      extension: {
        operationId: 'getextension',
        parameters: { testparameter: '$request.query.testparameter' }
      }
    });
  });
});
