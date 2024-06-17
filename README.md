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

## Running the Extension Locally

Press `F5` to run the extension locally. This should open up an Extension Development Host instance of VS Code. Open any docs repo that has a `snooty.toml` file (and pull any remote assets using `make` if it hasn't been done so already).


## Testing the Packaging Process

To test out a local build of the Snooty VSCode Extension, run the command `vsce package` at the root. Once successfully compiled, open a Docs Content repo (e.g. `cloud-docs`, `docs-landing`) in a VSCode window and navigate to the `Extensions` panel from the lefthand `Extensions` sidebar button. Click the button at the top of the panel with the ellipses (...) and select `Install from VSIX`. Choose the newly compiled file from your local `snooty-vscode` repo named in the format of `snooty-<version>.vsix`. This should enable your local branch as the extension utilized on your local machine's VSCode.

## Releasing

1. Create a personal access token, if you do not already have one: https://code.visualstudio.com/api/working-with-extensions/publishing-extension#get-a-personal-access-token
2. Ensure that you have a clean working directory with `git clean -xfd`.
3. Install dependencies with `npm install`.
4. Bump to the new version with `npm version <newversion>`.
5. Generate a bundle with `vsce package`, and [test it in your vscode installation](#how-to-run-locally-in-development).
6. Once you are satisfied, run `vsce publish` and enter the personal access token you created in step 1 when prompted.
7. Push up your work with `git push origin main && git push --tags origin`.
