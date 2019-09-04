import _ from 'lodash';
import log from 'loglevel';
import { OpenAPIV3 } from 'openapi-types';
import { isExternalRef, resolveComponentRef, sanitizeComponentName, serializeJsonPointer } from './openapi-tools';

interface PotentialLink {
  // The from and to strings are paths in the OpenAPI document
  from: string;
  to: string;
}

interface Link extends PotentialLink {
  // Keys are parameters of the 'from' path and values are parameters of the 'to' path
  parameterMap: Map<OpenAPIV3.ParameterObject, OpenAPIV3.ParameterObject>;
}

/**
 * Find path-pairs where a link may potentially be added. We have such a pair if:
 * - Both paths have a get-request defined that has at least one successful response
 * - The to path is an extension of the from path (e.g. from=/path, to=/path/extension
 *   but not from=/path, to=/pathA)
 * @param openapi The OpenAPI document
 */
function findPotentialLinkPairs(openapi: OpenAPIV3.Document): PotentialLink[] {
  const result: PotentialLink[] = [];

  // Only keep paths that have a get definition that has at least one
  // successful response defined. (Successful meaning HTTP code 2xx)
  const getPaths = Object.keys(openapi.paths).filter(path => {
    const pO = openapi.paths[path].get;
    return (
      pO != null &&
      pO.responses != null &&
      Object.keys(pO.responses)
        .map(key => parseInt(key, 10))
        .some(code => !isNaN(code) && code >= 200 && code < 300)
    );
  });

  // Search for a pair of paths such that one path is an extension of the other
  for (const path of getPaths) {
    for (const innerPath of getPaths) {
      if (
        path !== innerPath &&
        ((path.endsWith('/') && innerPath.startsWith(path)) || innerPath.startsWith(path + '/'))
      ) {
        result.push({
          from: path,
          to: innerPath
        });
      }
    }
  }

  log.debug(`Found ${result.length} potential link candidates`);
  return result;
}

/**
 * Takes a parameters array from the OpenAPI document and dereferences all the items.
 * @param openapi The OpenAPI document
 * @param parameters The parameters to be dereferenced
 */
function dereferenceParameters(
  openapi: OpenAPIV3.Document,
  parameters: Array<OpenAPIV3.ReferenceObject | OpenAPIV3.ParameterObject>
): OpenAPIV3.ParameterObject[] {
  return parameters.map(obj => {
    if ('$ref' in obj) {
      return resolveComponentRef(openapi, obj, 'parameters');
    } else {
      return obj;
    }
  });
}

/**
 * Check if two schema objects describe the same schema. This is done as follows:
 * If both schemas are references and contain the same URI, we consider them equal.
 * If exactly one schema is an external reference, we consider them not equal.
 * Otherwise, we derefence internal references and consider the schemas equal
 * if they contain the same properties with the same values.
 *
 * @param openapi The OpenAPI document
 * @param firstSchema The first schema or reference to check
 * @param secondSchema The second schema or reference to check
 */
function areSchemasMatching(
  openapi: OpenAPIV3.Document,
  firstSchema?: OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject,
  secondSchema?: OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject
): boolean {
  // If both schemas are undefined, we assume they are matching
  if (firstSchema == null && secondSchema == null) {
    return true;
  }
  // At this point, at most one schema can be undefined and the other is not
  if (firstSchema == null || secondSchema == null) {
    return false;
  }

  if ('$ref' in firstSchema && '$ref' in secondSchema) {
    // If we have two references, external or internal, we only check if they are equal
    return firstSchema.$ref === secondSchema.$ref;
  }

  // At this point at least one of the schemas is not a reference. If one is a reference
  // we require it to be internal because we currently do not parse external references.
  for (const param of [firstSchema, secondSchema]) {
    if ('$ref' in param && isExternalRef(param)) {
      return false;
    }
  }

  // Resolve the remaining internal schema references
  const first = '$ref' in firstSchema ? resolveComponentRef(openapi, firstSchema, 'schemas') : firstSchema;
  const second = '$ref' in secondSchema ? resolveComponentRef(openapi, secondSchema, 'schemas') : secondSchema;

  // Check if the schemas are equal
  return _.isEqual(first, second);
}

/**
 * Check if two parameter objects can be considered equal. To do that, we use a simple heuristic: *
 * We assume that parameters with the same name and same schema have identical meaning across different
 * operations. This heuristic is implemented in this function.
 *
 * @param openapi The OpenAPI document
 * @param firstParameter The first parameter to check
 * @param secondParameter The second parameter to check
 */
function areParametersMatching(
  openapi: OpenAPIV3.Document,
  firstParameter: OpenAPIV3.ParameterObject,
  secondParameter: OpenAPIV3.ParameterObject
): boolean {
  // Check if the names are equal
  if (firstParameter.name !== secondParameter.name) {
    return false;
  }

  // Check if the schemas are equal
  return areSchemasMatching(openapi, firstParameter.schema, secondParameter.schema);
}

/**
 * Filter the list of potential links by looking at the parameters.
 * To do this, we assume that parameters of different paths with same name and schema have the same meaning.
 *
 * If there is a required parameter of the 'to' path and the 'from' path does not have a matching parameter,
 * we discard this potential link. Otherwise we save the matching parameters in the parametersMap.
 * @param openapi The OpenAPI document
 * @param links An array of potential links
 */
function processLinkParameters(openapi: OpenAPIV3.Document, links: PotentialLink[]): Link[] {
  // Filter the potential links where the 'to' path requires parameters that are non-existent in the 'from' path
  const newLinks: Link[] = [];
  log.debug('Processing potential link candidates');

  for (const link of links) {
    const fromPath = openapi.paths[link.from];
    const fromGet = fromPath.get as OpenAPIV3.OperationObject;
    const toPath = openapi.paths[link.to];
    const toGet = toPath.get as OpenAPIV3.OperationObject;

    // Check if there is any external parameter reference in the to-path. If yes, we drop this link candidate as
    // we currently can not handle external references.
    if (
      [...(toGet.parameters || []), ...(toPath.parameters || [])].some(
        parameter => '$ref' in parameter && isExternalRef(parameter)
      )
    ) {
      log.debug(`  Dropping link candidate due to external parameter reference: '${link.from}' => '${link.to}'`);
    } else {
      // Create parameter lists incorporating the path and the operation parameters.
      // At this point, we know that there are no external references in the to-path. We filter out all
      // the external references from the from-path.
      const fromParams = dereferenceParameters(
        openapi,
        (fromGet.parameters || []).filter(param => !('$ref' in param && isExternalRef(param)))
      );
      if (fromPath.parameters != null) {
        fromParams.push(
          // Filter overriden parameters
          ...dereferenceParameters(openapi, fromPath.parameters).filter(param =>
            fromParams.every(innerParam => innerParam.name !== param.name)
          )
        );
      }
      const toParams = dereferenceParameters(openapi, toGet.parameters || []);
      if (toPath.parameters != null) {
        toParams.push(
          // Filter overriden parameters
          ...dereferenceParameters(openapi, toPath.parameters).filter(param =>
            toParams.every(innerParam => innerParam.name !== param.name)
          )
        );
      }

      // Ignore cookie parameters as they are assumed to be automatically conveyed
      _.remove(toParams, parameter => parameter.in === 'cookie');
      _.remove(fromParams, parameter => parameter.in === 'cookie');

      // We use a simple heuristic: We assume that parameters with the same name and same schema have identical meaning
      // across different operations. Therefore, we filter the potential links where all parameters for the to-operation
      // are already given by the from operation.
      const parameterMap = new Map<OpenAPIV3.ParameterObject, OpenAPIV3.ParameterObject>();
      const valid = toParams.every(toParam => {
        // If both schema-definitions are null the equality check also succeeds
        const fromParam = fromParams.find(p => areParametersMatching(openapi, toParam, p));
        if (fromParam != null) {
          parameterMap.set(fromParam, toParam);
          return true;
        } else {
          // We have not found a matching from-parameter. However, we do not need one if the parameter is optional.
          return toParam.required == null || toParam.required === false;
        }
      });

      if (valid) {
        newLinks.push({
          ...link,
          parameterMap
        });
        log.debug(`  Valid link candidate found: '${link.from}' => '${link.to}', ${parameterMap.size} parameter(s)`);
      }
    }
  }

  log.debug(`Found ${newLinks.length} valid link candidates`);
  return newLinks;
}

/**
 * Adds link definitions to the given OpenAPI document based on a heuristic.
 *
 * A link from a path p1 to a path p2 is added under the following conditions:
 * - p2 starts with p1
 * - p1 and p2 have a get-request definition with at least one successful response defined
 * - For every required parameter of p2, there is a parameter with the same name and schema of p1
 * @param openapi The OpenAPI document
 */
export function addLinkDefinitions(openapi: OpenAPIV3.Document): { openapi: OpenAPIV3.Document; numLinks: number } {
  let numAddedLinks = 0;
  openapi = _.cloneDeep(openapi);
  const potLinks = processLinkParameters(openapi, findPotentialLinkPairs(openapi));

  potLinks.forEach(potLink => {
    const fromGet = openapi.paths[potLink.from].get as OpenAPIV3.OperationObject;
    const fromResponses = fromGet.responses as OpenAPIV3.ResponsesObject;
    const toGet = openapi.paths[potLink.to].get as OpenAPIV3.OperationObject;

    // All response objects for successful response codes for a get request.
    // $refs are resolved and deduplicated with _.uniq.
    // We know that this array is non empty because we filtered those in 'findPotentialLinkPairs'.
    const successGetResponses = _.uniq(
      Object.keys(fromResponses)
        .map(key => parseInt(key, 10))
        .filter(code => !isNaN(code) && code >= 200 && code < 300)
        .map(code => {
          const obj = fromResponses[code];
          if ('$ref' in obj) {
            return resolveComponentRef(openapi, obj, 'responses');
          } else {
            return obj;
          }
        })
    );

    // Create the link definition object
    const parametersObject: { [parameter: string]: any } = {};
    potLink.parameterMap.forEach((toParam, fromParam) => {
      // fromParam.in can only be 'query', 'header', 'path', 'cookie' according to the definition.
      // We have ruled out 'cookie' in 'processLinkParameters', so this is a valid Runtime Expression.
      parametersObject[toParam.name] = `$request.${fromParam.in}.${fromParam.name}`;
    });
    // We use the operationId when possible and the reference else
    let operationId: string | undefined;
    let operationRef: string | undefined;
    if (toGet.operationId != null) {
      operationId = toGet.operationId;
    } else {
      operationRef = '#' + serializeJsonPointer(['paths', potLink.from, 'get']);
    }
    const linkDefinition = {
      description: `Automatically generated link definition`,
      ...(operationId != null ? { operationId } : {}),
      ...(operationRef != null ? { operationRef } : {}),
      parameters: parametersObject
    };

    // Link Name is the name of the link in the link-definition of a response.
    const toLinkParts = potLink.to.split('/');
    const linkName = sanitizeComponentName(
      potLink.to.endsWith('/') ? toLinkParts[toLinkParts.length - 2] : toLinkParts[toLinkParts.length - 1]
    );

    if (successGetResponses.length === 1) {
      // We only have one response, so we define the link directly in that response.
      const response = successGetResponses[0];
      if (response.links == null) {
        response.links = {};
      }
      // Prevent overwriting existing links
      let dedupLinkName = linkName;
      while (dedupLinkName in response.links) {
        dedupLinkName += '1';
      }
      response.links[dedupLinkName] = linkDefinition;
      numAddedLinks++;
    } else {
      // We have multiple responses where this link should be added, so we save the link in
      // the components section and reference it in every response to prevent defining it multiple times.
      if (openapi.components == null) {
        openapi.components = {};
      }
      if (openapi.components.links == null) {
        openapi.components.links = {};
      }

      // Reference name is the name of the link-definition in the components-section.
      let referenceName = linkName;
      // Prevent overwriting existing link-components with the same name
      while (referenceName in openapi.components.links) {
        referenceName += '1';
      }
      openapi.components.links[referenceName] = linkDefinition;

      successGetResponses.forEach(response => {
        if (response.links == null) {
          response.links = {};
        }
        // Prevent overwriting existing links
        let dedupLinkName = linkName;
        while (dedupLinkName in response.links) {
          dedupLinkName += '1';
        }
        response.links[dedupLinkName] = {
          $ref: '#' + serializeJsonPointer(['components', 'links', referenceName])
        };
        numAddedLinks++;
      });
    }
  });

  log.debug(`Added ${numAddedLinks} links to response definitions`);
  return { openapi, numLinks: numAddedLinks };
}
