import { findReferences } from "../findReferences";
import { TextDocument } from "vscode-languageserver-textdocument";

test("finds no references", () => {
  const document = TextDocument.create(
    "test",
    "",
    0,
    `
There are no references in this document.
:ref: is close, but not.
:ref:\`? forget it.
`
  );

  const references = findReferences(document);
  expect(references.length).toBe(0);
});

test("finds a label-only reference", () => {
  const document = TextDocument.create(
    "test",
    "",
    0,
    "This document has :ref:`one-reference`"
  );

  const references = findReferences(document);
  expect(references.length).toBe(1);
  expect(references[0].location.uri).toBe("test");
  expect(references[0].location.range.start.line).toBe(0);
  expect(references[0].location.range.start.character).toBe(18);
  expect(document.getText(references[0].location.range)).toBe(
    ":ref:`one-reference`"
  );
  expect(references[0].name).toBe("one-reference");
  expect(references[0].type).toBe("rst.role.ref");
});

test("finds a reference with text", () => {
  const document = TextDocument.create(
    "test",
    "",
    0,
    "This document has :ref:`a reference with text <reference-with-text>`"
  );

  const references = findReferences(document);
  expect(references.length).toBe(1);
  expect(references[0].location.range.start.line).toBe(0);
  expect(references[0].location.range.start.character).toBe(18);
  expect(document.getText(references[0].location.range)).toBe(
    ":ref:`a reference with text <reference-with-text>`"
  );
  expect(references[0].name).toBe("reference-with-text");
});

test("finds a multi-line reference with text", () => {
  const document = TextDocument.create(
    "test",
    "",
    0,
    `This document has :ref:\`a reference with text
that spans multiple lines <multiline>\`
`
  );

  const references = findReferences(document);
  expect(references.length).toBe(1);
  expect(references[0].location.range.start.line).toBe(0);
  expect(references[0].location.range.start.character).toBe(18);
  expect(references[0].location.range.end.line).toBe(1);
  expect(references[0].location.range.end.character).toBe(38);
  expect(document.getText(references[0].location.range))
    .toBe(`:ref:\`a reference with text
that spans multiple lines <multiline>\``);
  expect(references[0].name).toBe("multiline");
});

test("finds multiple references", () => {
  const document = TextDocument.create(
    "test",
    "",
    0,
    `
This document has :ref:\`one-reference\`.
This document has :ref:\`another-reference\`.
`
  );

  const references = findReferences(document);
  expect(references.length).toBe(2);
  expect(references[0].name).toBe("one-reference");
  expect(references[1].name).toBe("another-reference");
});

test("finds multiple kinds of references", () => {
  const document = TextDocument.create(
    "test",
    "",
    0,
    `
This document has :ref:\`one-reference\`.
This document has :ref:\`another-reference\`.
This document has :ref:\`another kind of reference <one-reference>\`.
This document even has :ref:\`invalid references <invalid reference >\`, but findReferences() doesn't care.
There are :ref:\`multiline
references <multiline>\` here.
This document also has things that look like a reference :ref: :REF:\`nope\` but aren't.
`
  );

  const references = findReferences(document);
  expect(references.length).toBe(5);
  expect(references[0].name).toBe("one-reference");
  expect(references[1].name).toBe("another-reference");
  expect(references[2].name).toBe("one-reference");
  expect(references[3].name).toBe("invalid reference ");
  expect(references[4].name).toBe("multiline");
  expect(document.getText(references[4].location.range)).toBe(`:ref:\`multiline
references <multiline>\``);
});

test("ignores commented-out references", () => {
  const document = TextDocument.create(
    "test",
    "",
    0,
    `
.. This document has :ref:\`one-reference\` but it's commented out
This document has :ref:\`an-uncommented-reference\` as well
    .. :ref:\`this one <one-reference>\` is also commented out
`
  );

  const references = findReferences(document);
  expect(references.length).toBe(1);
  expect(references[0].name).toBe("an-uncommented-reference");
});
