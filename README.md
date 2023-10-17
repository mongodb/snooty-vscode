# LSP Example

Heavily documented sample code for https://code.visualstudio.com/api/language-extensions/language-server-extension-guide

## Functionality

This Language Server works for plain text file. It has the following language features:

- Completions
- Diagnostics regenerated on each file change or configuration change

It also includes an End-to-End test.

## Structure

```
.
├── client // Language Client
│   ├── src
│   │   ├── test // End to End tests for Language Client / Server
│   │   └── extension.ts // Language Client entry point
└── package.json // The extension manifest.
```

## How to run locally in development

To test out a local build of the Snooty VSCode Extension, run the command `vsce package` at the root. Once successfully compiled, open a Docs Content repo (e.g. `cloud-docs`, `docs-landing`) in a VSCode window and navigate to the `Extensions` panel from the lefthand `Extensions` sidebar button. Click the button at the top of the panel with the ellipses (...) and select `Install from VSIX`. Choose the newly compiled file from your local `snooty-vscode` repo named in the format of `snooty-<version>.vsix`. This should enable your local branch as the extension utilized on your local machine's VSCode.


## Running the Sample

- Run `npm install` in this folder. This installs all necessary npm modules in the client folder
- Open VS Code on this folder.
- Press Ctrl+Shift+B to compile the client.
- Switch to the Debug viewlet.
- Select `Launch Client` from the drop down.
- Run the launch config.
- If you want to debug the server as well use the launch configuration `Attach to Server`
- In the [Extension Development Host] instance of VSCode, open a document in 'plain text' language mode.
  - Type `j` or `t` to see `Javascript` and `TypeScript` completion.
  - Enter text content such as `AAA aaa BBB`. The extension will emit diagnostics for all words in all-uppercase.
