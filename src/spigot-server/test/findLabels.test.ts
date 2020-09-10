import { findLabels } from "../findLabels";
import { TextDocument } from "vscode-languageserver-textdocument";

test("finds no labels", () => {
  const document = TextDocument.create(
    "test",
    "",
    0,
    `
There are no labels in this document.
.. is close, but not.
.. a _something:? forget it.
.. _also not a label:
`
  );

  const labels = findLabels(document);
  expect(labels.length).toBe(0);
});

test("finds labels", () => {
  const document = TextDocument.create(
    "test",
    "",
    0,
    `This document has one label:

.. _its-a-label:
`
  );

  const labels = findLabels(document);
  expect(labels.length).toBe(1);
  expect(labels[0].location.uri).toBe("test");
  expect(labels[0].location.range.start.line).toBe(2);
  expect(labels[0].location.range.start.character).toBe(0);
  expect(document.getText(labels[0].location.range)).toBe(".. _its-a-label:");
  expect(labels[0].name).toBe("its-a-label");
  expect(labels[0].type).toBe("rst.label");
});

test("ignores commented-out labels", () => {
  const document = TextDocument.create("test", "", 0, `.. .. _commented-out:`);

  const labels = findLabels(document);
  expect(labels.length).toBe(0);
});
