import { TextDocument } from "vscode-languageserver";
import { isCommentedOut } from "./isCommentedOut";
import { Entity, EntityType } from "./Entity";

// Finds entities of the specified type in the given file according to the given patterns.
export function findEntities(
  document: TextDocument,
  patterns: RegExp[],
  entityType: EntityType
): Entity[] {
  const { uri } = document;
  const text = document.getText();
  const found: Entity[] = [];

  patterns.forEach((pattern) => {
    let m: RegExpExecArray | null;

    while ((m = pattern.exec(text))) {
      const range = {
        start: document.positionAt(m.index),
        end: document.positionAt(m.index + m[0].length),
      };

      // Ignore commented lines
      if (isCommentedOut(document, range)) {
        continue;
      }

      const label = m[1];

      const entity: Entity = {
        name: label,
        type: entityType,
        location: {
          uri,
          range,
        },
      };

      found.push(entity);
    }
  });

  if (patterns.length > 1) {
    // Order the entities in the order they appear in the document
    found.sort(
      (a, b) =>
        document.offsetAt(a.location.range.start) -
        document.offsetAt(b.location.range.start)
    );
  }

  return found;
}
