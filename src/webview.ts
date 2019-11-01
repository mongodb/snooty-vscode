import * as vscode from "vscode";
import * as path from "path";

export function startWebview(
  context: vscode.ExtensionContext,
  projectName: string,
  previewPage: string
): void {
  // Choose template. Guarantees the correct fonts are loaded in as well
  const template = projectName === "guides" ? "guides.css" : "mongodb-docs.css";
  // Create panel
  const panel = vscode.window.createWebviewPanel(
    "snootyPreview",
    `Snooty Preview - ${previewPage}`,
    {
      preserveFocus: true,
      viewColumn: vscode.ViewColumn.Beside
    },
    {
      enableScripts: true,
      retainContextWhenHidden: true
    }
  );

  // Set up resource files needed for page to render (bundle and css)
  // If file does not exist, panel will show empty content
  const bundlePath = path.join(
    context.extensionPath,
    "snooty-frontend/preview",
    "bundle.js"
  );
  const bundleFile = getResource(bundlePath);
  // TODO: Add validation through parser to see which css file to use.
  // For testing purposes, only support guides until we get communication between extension and frontend working
  const cssPath = path.join(
    context.extensionPath,
    "snooty-frontend/static/docs-tools",
    template
  );
  const cssFile = getResource(cssPath);

  // Assign html content to webview panel
  panel.webview.html = getWebviewContent(bundleFile, cssFile);
}

// Takes a path to a file and converts it to a secure resource for webview
function getResource(path: string): vscode.Uri {
  const fileUri = vscode.Uri.file(path);
  return fileUri.with({ scheme: "vscode-resource" });
}

// Returns html template used to render preview
function getWebviewContent(bundleScript: vscode.Uri, css: vscode.Uri): string {
  return `
	<!DOCTYPE html>
	<html lang="en">
	<head>
		<meta charSet="utf-8" />
		<meta httpEquiv="x-ua-compatible" content="ie=edge" />
		<meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
		<meta httpEquiv="Content-Type" content="text/html; charset=utf-8" />
		<meta name="robots" content="index" />
		<meta name="release" content="1.0" />
		<meta name="version" content="master" />
		<meta name="DC.Source" content="https://github.com/mongodb/docs-bi-connector/blob/DOCSP-3279/source/index.txt" />
		<meta
			property="og:image"
			content="http://s3.amazonaws.com/info-mongodb-com/_com_assets/cms/mongodb-for-giant-ideas-bbab5c3cf8.png"
		/>
		<meta
			property="og:image:secure_url"
			content="https://webassets.mongodb.com/_com_assets/cms/mongodb-for-giant-ideas-bbab5c3cf8.png"
		/>
		<meta
			http-equiv="Content-Security-Policy"
			content="default-src 'none'; 
			img-src vscode-resource: https: data:; 
			script-src 'unsafe-eval' vscode-resource: data:; 
			style-src 'unsafe-inline' vscode-resource: https:;
			font-src https: vscode-resource:"
		/>
		<link href="https://fonts.googleapis.com/css?family=Inconsolata" rel="stylesheet" type="text/css" />
		<link rel="shortcut icon" href="https://media.mongodb.org/favicon.ico" />
		<link
			rel="search"
			type="application/opensearchdescription+xml"
			href="https://docs.mongodb.com/osd.xml"
			title="MongoDB Help"
		/>
		<link href="${css}" rel="stylesheet" type="text/css"/>
		<style>
			body {
			background: white
			}
		</style>
	</head>
	<body>
		<div id="app"></div>
		<script src="${bundleScript}"></script>
	</body>
	</html>`;
}
