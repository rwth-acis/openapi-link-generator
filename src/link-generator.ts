import _ from 'lodash';
import log from 'loglevel';
import { OpenAPIV3 } from 'openapi-types';
import { resolveComponentRef } from './openapi-tools';

interface PotentialLink {
  from: string;
  to: string;
}

interface Link extends PotentialLink {
  parameterMap: Map<OpenAPIV3.ParameterObject, OpenAPIV3.ParameterObject>;
}

function findPotentialLinkPairs(oas: OpenAPIV3.Document): PotentialLink[] {
  const result: PotentialLink[] = [];

  // Only keep paths that have a get definition that has at least one
  // successful response defined. (Successful meaning HTTP code 2xx)
  const getPaths = Object.keys(oas.paths).filter(path => {
    const pO = oas.paths[path].get;
    return (
      pO != null &&
      pO.responses != null &&
      Object.keys(pO.responses)
        .map(key => parseInt(key, 10))
        .some(code => !isNaN(code) && code >= 200 && code < 300)
    );
  });

  // Search for a pair of paths such that one path starts with the other
  for (const path of getPaths) {
    for (const innerPath of getPaths) {
      if (path !== innerPath && innerPath.startsWith(path)) {
        result.push({
          from: path,
          to: innerPath
        });
      }
    }
  }

  log.debug(`Found ${result.length} potential links`);
  return result;
}

function dereferenceParameters(
  oas: OpenAPIV3.Document,
  parameters: Array<OpenAPIV3.ReferenceObject | OpenAPIV3.ParameterObject>
): OpenAPIV3.ParameterObject[] {
  return parameters.map(obj => {
    if ('$ref' in obj) {
      return resolveComponentRef(oas, obj, 'parameters');
    } else {
      return obj;
    }
  });
}

function processLinkParameters(oas: OpenAPIV3.Document, links: PotentialLink[]): Link[] {
  // Filter the potential links where the 'to' path requires parameters that are non-existent in the 'from' path
  const newLinks: Link[] = [];
  log.debug('Processing potential links');

  for (const link of links) {
    const fromPath = oas.paths[link.from];
    const fromGet = fromPath.get as OpenAPIV3.OperationObject;
    const toPath = oas.paths[link.to];
    const toGet = toPath.get as OpenAPIV3.OperationObject;

    // Create parameter lists incorporating the path and the operation parameters
    const fromParams = fromGet.parameters != null ? dereferenceParameters(oas, fromGet.parameters) : [];
    if (fromPath.parameters != null) {
      fromParams.push(
        // Filter overriden parameters
        ...dereferenceParameters(oas, fromPath.parameters).filter(param =>
          fromParams.every(innerParam => innerParam.name !== param.name)
        )
      );
    }
    const toParams = toGet.parameters != null ? dereferenceParameters(oas, toGet.parameters) : [];
    if (toPath.parameters != null) {
      toParams.push(
        // Filter overriden parameters
        ...dereferenceParameters(oas, toPath.parameters).filter(param =>
          toParams.every(innerParam => innerParam.name !== param.name)
        )
      );
    }

    // We can not handle cookie parameters as of now
    if (toParams.some(parameter => parameter.in === 'cookie')) {
      log.warn(`Cookie parameters are currently not supported. Ignoring path '${link.to}'.`);
      continue;
    }

    // We use a simple heuristic: We assume that parameters with the same name and same schema have identical meaning
    // across different operations. Therefore, we filter the potential links where all parameters for the to-operation
    // are already given by the from operation.
    const parameterMap = new Map<OpenAPIV3.ParameterObject, OpenAPIV3.ParameterObject>();
    const valid = toParams.every(toParam => {
      // If both schema-definitions are null the equality check also succeeds
      const fromParam = fromParams.find(p => p.name === toParam.name && _.isEqual(p.schema, toParam.schema));
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
      log.debug(`  Valid link found: '${link.from}' => '${link.to}', ${parameterMap.size} parameter(s)`);
    }
  }

  log.debug(`Found ${newLinks.length} valid links`);
  return newLinks;
}

export default function addLinkDefinitions(oas: OpenAPIV3.Document): OpenAPIV3.Document {
  const potLinks = processLinkParameters(oas, findPotentialLinkPairs(oas));
  potLinks.forEach(potLink => {
    const fromGet = oas.paths[potLink.from].get as OpenAPIV3.OperationObject;
    const fromResponses = fromGet.responses as OpenAPIV3.ResponsesObject;

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
            return resolveComponentRef(oas, obj, 'responses');
          } else {
            return obj;
          }
        })
    );

    // We now add a new link definition to the components section and reference it in every response
    if (oas.components == null) {
      oas.components = {};
    }
    if (oas.components.links == null) {
      oas.components.links = {};
    }

    // Link Name is the name of the link in the link-definition of a response.
    // Reference name is the name of the link-definition in the components-section.
    let linkName = _.last(potLink.to.split('/')) as string;
    let referenceName = linkName;

    // Prevent overwriting existing link-components with the same name
    while (referenceName in oas.components.links) {
      referenceName += '1';
    }

    const parametersObject: { [parameter: string]: any } = {};
    potLink.parameterMap.forEach((toParam, fromParam) => {
      // fromParam.in can only be 'query', 'header', 'path', 'cookie' according to the definition.
      // We have ruled out 'cookie' in 'processLinkParameters', so this is a valid Runtime Expression.
      parametersObject[toParam.name] = `$request.${fromParam.in}.${fromParam.name}`;
    });
    oas.components.links[referenceName] = {
      description: `Automatically generated link definition`,
      operationRef: `#/paths/${potLink.from.replace(/\//g, '~1')}/get`,
      parameters: parametersObject
    };

    successGetResponses.forEach(response => {
      if (response.links == null) {
        response.links = {};
      }
      // Prevent overwriting existing links
      while (linkName in response.links) {
        linkName += '1';
      }
      response.links[linkName] = {
        $ref: `#/components/links/${referenceName}`
      };
    });
  });

  return oas;
}
