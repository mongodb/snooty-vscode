# Snooty VS Code

## Setting Up Parser Communication

If you're working on changes to the Snooty VS Code extension, it will be useful to set up your local repo of the [Snooty Parser](https://github.com/mongodb/snooty-parser). Make sure to follow the instructions found [here](https://github.com/mongodb/snooty-parser/blob/master/HACKING.md#developing-snooty) to be able to modify the parser.

Communication between the Snooty extension and the parser are performed via remote procedure calls (RPC) found in the parser's language server. To allow the VS Code extension to communicate to your local repo of the parser, do the following:

1. Navigate to your copy of `snooty-parser`.
2. Run the following command: `echo $(poetry env info -p)/bin/snooty`. This gives you the path for the parser's language server. Copy the path returned by this command.
3. Open your local `snooty-vscode` copy in VSCode.
4. Press `Cmd` + `Shift` + `P` to open a list of commands.
5. Run `Preferences: Open Settings (JSON)` to open `settings.json` for VS Code.
3. Add the following in `settings.json`:

```
"snooty.languageServerPath": "<COPIED_PATH>",
```
where `<COPIED_PATH>` is the path you copied in Step 2.

## Making Client Requests

RPC calls are made from the extension to the parser using the following:
```
client.sendRequest({parameter: argument}, (returnValue) => {
	// do stuff
});
```

## Running the Extension Locally

Press `F5` to run the extension locally. This should open up an Extension Development Host instance of VS Code. Open any docs repo that has a `snooty.toml` file (and pull any remote assets using `make` if it hasn't been done so already).