import { Range } from "vscode-languageserver-textdocument";
import { TextDocument, Position } from "vscode-languageserver";

// Quick and dirty rST comment check. A proper parser can detect block comments, etc.
export function isCommentedOut(
  textDocument: TextDocument,
  range: Range
): boolean {
  if (range.start.character === 0) {
    return false;
  }

  // Check the line so far up to the label directive
  const lineUpToRange = textDocument.getText({
    start: Position.create(range.start.line, 0),
    end: range.start,
  });

  return /\.\.\s/.test(lineUpToRange);
}
