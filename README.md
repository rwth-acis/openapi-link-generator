# OpenAPI Link-Generator

OpenAPI Link-Generator is a tool that enhances an existing OpenAPI documentation by adding link definitions whenever possible.
A Swagger/OpenAPI 2.0 input is automatically converted to OpenAPI 3.0 and the output is always in OpenAPI 3.0 format.
Both YAML and JSON supported.

## Usage

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
