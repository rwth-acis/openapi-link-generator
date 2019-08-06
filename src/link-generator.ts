import _ from 'lodash';
import log from 'loglevel';
import { OpenAPIV3 } from 'openapi-types';
import { isNumber } from 'util';
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
        .map(parseInt)
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
    const fromGet = oas.paths[link.from].get as OpenAPIV3.OperationObject;
    const toGet = oas.paths[link.to].get as OpenAPIV3.OperationObject;

    const fromParams = fromGet.parameters != null ? dereferenceParameters(oas, fromGet.parameters) : [];
    const toParams = toGet.parameters != null ? dereferenceParameters(oas, toGet.parameters) : [];

    // We use a simple heuristic: We assume that parameters with the same name and same schema have identical meaning
    // across different operations. Therefore, we filter the potential links where all parameters for the to-operation
    // are already given by the from operation.
    const parameterMap = new Map<OpenAPIV3.ParameterObject, OpenAPIV3.ParameterObject>();
    const valid = fromParams.every(fromParam => {
      // If both schema-definitions are null the equality check also succeeds
      const toParam = toParams.find(p => p.name === fromParam.name && _.isEqual(p.schema, fromParam.schema));
      if (toParam != null) {
        parameterMap.set(fromParam, toParam);
        return true;
      } else {
        return false;
      }
    });

    if (valid) {
      newLinks.push({
        ...link,
        parameterMap
      });
      log.debug(`  Valid link found: '${link.from}' => '${link.to}'`);
    }
  }

  log.debug(`Found ${newLinks.length} valid links`);
  return newLinks;
}

export default function addLinkDefinitions(oas: OpenAPIV3.Document) {
  const potLinks = processLinkParameters(oas, findPotentialLinkPairs(oas));
  // TODO actually add the link definitions to the oas
  console.log(potLinks);

  return oas;
}
