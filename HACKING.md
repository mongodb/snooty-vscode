# Snooty VS Code

## Setting Up Parser Communication

If you're working on changes to the Snooty VS Code extension, it will be useful to set up your local repo of the [Snooty Parser](https://github.com/mongodb/snooty-parser). Make sure to follow the instructions found [here](https://github.com/mongodb/snooty-parser/blob/master/HACKING.md#developing-snooty) to be able to modify the parser.

Communication between the Snooty extension and the parser are performed via remote procedure calls (RPC) found in the parser's language server. To allow the VS Code extension to communicate to your local repo of the parser, do the following:

1. Press `Cmd` + `Shift` + `P` to open a list of commands.
2. Run `Preferences: Open Settings (JSON)` to open `settings.json` for VS Code.
3. Add the following in `settings.json`:

```
"snooty.languageServerPath": "/usr/local/Cellar/python/3.7.3/Frameworks/Python.framework/Versions/3.7/bin/snooty",
```

## Making Client Requests

RPC calls are made from the extension to the parser using the following:
```
client.sendRequest({parameter: argument}, (returnValue) => {
	// do stuff
});
```

## Running the Extension Locally

Press `F5` to run the extension locally. This should open up an Extension Development Host instance of VS Code. Open any docs repo that has a `snooty.toml` file (and pull any remote assets using `make` if it hasn't been done so already).

## Snooty Submodule

Before working on Snooty Preview, it is important to set up the submodule for the [Snooty frontend components](https://github.com/mongodb/snooty).

To set up, run:
```
make frontend
```

## Snooty Preview

Snooty Preview is a feature that allows the user to preview a single page as it would look like on the documentation site, without having to formally build the entire site. Snooty Frontend is used as a submodule to make use of the frontend components needed to render the page. The parser is responsible for passing along the abstract syntax tree (AST) and other data needed by the frontend components.

Snooty Preview can be broken down into the following files:

* `preview.ts`: Contains tasks and commands needed for Snooty Preview's workflow.
* `webview.ts`: Handles creating a webview panel for the preview page.

More information on Snooty Preview can be found [here](https://github.com/mongodb/snooty/blob/master/HACKING.md#vs-code-extension).
