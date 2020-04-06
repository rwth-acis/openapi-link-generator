# OpenAPI-Link-Generator

![GitHub Workflow Status](https://img.shields.io/github/workflow/status/rwth-acis/openapi-link-generator/CI)
![npm](https://img.shields.io/npm/v/openapi-link-generator)
![License](https://img.shields.io/github/license/rwth-acis/openapi-link-generator)

OpenAPI-Link-Generator is a tool that enhances an existing OpenAPI documentation by adding link definitions whenever possible.
It accepts Swagger/OpenAPI 2.0 or OpenAPI 3.0 input.
The output is always in OpenAPI 3.0 format.
Both YAML and JSON are supported.

## Assumption

The link-generator works on the assumption that when there are two parameters for two different paths that have the same name and the same schema, those parameters are semantically identical.

## Functionality

The link-generator adds a link from path A to path B whenever:

- Path B starts with path A (e.g. `A = /example` and `B = /example/extension`)
- The required parameters for path B are a subset of all the parameters for path A (considering the assumption above)

## Getting Started

OpenAPI-Link-Generator can directly be run using `npx`:

```
npx openapi-link-generator [options] <Swagger/OpenAPI file path>
```

You can run the following command to print the help-page:

```
npx openapi-link-generator --help
```

## Development

### Prerequisites

To work with the program make sure you have a recent version of node installed.
The tool was tested with node `v10.15` but other recent versions should work as well.
Then, install the necessary dependencies by running

```
npm install
```

in the project root directory.

### Run

You can run the tool by executing

```
npm start -- <arguments>
```

where `arguments` are the command line arguments you want to pass to the tool.
You can use the help-argument to find out what arguments are supported:

```
npm start -- --help
```

### Develop

You can now run the tool in development mode by executing

```
npm run dev -- <arguments>
```

The difference to `npm start` is that the program will automatically recompile and rerun when any of the source files change.

### Test

To run the tests, simply execute

```
npm test
```
