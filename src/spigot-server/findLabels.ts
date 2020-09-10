import { TextDocument } from "vscode-languageserver";
import { Entity } from "./Entity";
import { findEntities } from "./findEntities";

// Scans a document for a list of labels
export function findLabels(document: TextDocument): Entity[] {
  return findEntities(document, [/\.\. _([A-z-]+):/g], "rst.label");
}
