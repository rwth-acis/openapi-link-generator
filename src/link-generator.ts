import log from 'loglevel';
import { OpenAPIV3 } from 'openapi-types';

interface PotentialLink {
  from: string;
  to: string;
}

function findPotentialLinkPairs(oas: OpenAPIV3.Document): PotentialLink[] {
  const result: PotentialLink[] = [];

  // Filter paths that do not have a get-definition
  const getPaths = Object.keys(oas.paths).filter(path => oas.paths[path].get != null);

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

function filterForParameters(oas: OpenAPIV3.Document, links: PotentialLink[]): PotentialLink[] {
  // Filter the potential links where the 'to' path requires parameters that are non-existent in the 'from' path
  for (const link of links) {
    const fromGet = oas.paths[link.from].get as OpenAPIV3.OperationObject;
    const toGet = oas.paths[link.to].get as OpenAPIV3.OperationObject;

    const fromParams = fromGet.parameters;
    // TODO
  }
  return links;
}

export default function addLinkDefinitions(oas: OpenAPIV3.Document) {
  // TODO
  // Find potential link pairs, add link if parameters match
  const potLinks = filterForParameters(oas, findPotentialLinkPairs(oas));
  console.log(potLinks);
}
