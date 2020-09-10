import { DocumentUri, Position, TextDocument } from "vscode-languageserver";
import { Entity } from "./Entity";
import { Project } from "./Project";
import { Entities } from "./Entities";

// Finds an entity, if any, at the given position of the given document
export function findEntityAtPosition(
  entities: Entities,
  document: TextDocument | undefined,
  position: Position
): Entity | null {
  if (!document) {
    return null;
  }

  const entitiesInDocument = entities.getEntitiesInDocument(document.uri);
  if (!entitiesInDocument) {
    return null;
  }

  const offset = document.offsetAt(position);

  // Find an entity that is near the cursor
  return (
    entitiesInDocument.find(({ location }) => {
      const { range } = location;
      const start = document.offsetAt(range.start);
      const end = document.offsetAt(range.end);
      return start <= offset && offset < end;
    }) ?? null
  );
}
