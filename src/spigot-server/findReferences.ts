import { TextDocument } from "vscode-languageserver";
import { Entity } from "./Entity";
import { findEntities } from "./findEntities";

// Scans a document for a list of references (to labels)
export function findReferences(document: TextDocument): Entity[] {
  return findEntities(
    document,
    [
      // :ref:`some text <label>`
      /:ref:`[^<>`]*?<([^`>]*?)>`/gms,

      // :ref:`label`
      /:ref:`([^<>`]*?)`/gms,
    ],
    "rst.role.ref"
  );
}
