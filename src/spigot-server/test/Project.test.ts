import { Project } from "../Project";
import { TextDocument } from "vscode-languageserver-textdocument";

test("can add and update documents", () => {
  const project = new Project();

  expect(project.documentCount).toBe(0);

  const document = TextDocument.create(
    "test",
    "",
    0,
    `
This document has two entities. A label:

.. _some-ref:

...and a reference to :ref:\`some-ref\`.
`
  );

  project.addDocument(document);

  expect(project.documentCount).toBe(1);
  expect(project.getDocument("test")).toBeDefined();

  // Only one document entry per URI
  project.addDocument(document);
  expect(project.documentCount).toBe(1);
});

let project: Project;
let document: TextDocument;
let document2: TextDocument;
let documentWithNoRefs: TextDocument;

beforeEach(() => {
  project = new Project();

  expect(project.documentCount).toBe(0);

  document = TextDocument.create(
    "test",
    "",
    0,
    `
This document has two entities. A label:

.. _some-ref:

...and a reference to :ref:\`some-ref\`.
`
  );
  document2 = TextDocument.create(
    "test2",
    "",
    0,
    `This document has another reference to :ref:\`some-ref\`.`
  );

  documentWithNoRefs = TextDocument.create(
    "test3",
    "",
    0,
    "some-ref (This is not a ref, but its name matches)"
  );
  project.addDocument(document);
  project.updateDocument(document);
  project.updateDocument(document2);
  project.updateDocument(documentWithNoRefs);
});

test("can remove documents", () => {
  expect(project.documentCount).toBe(3);

  project.removeDocument(document.uri);
  expect(project.documentCount).toBe(2);

  project.removeDocument(document2.uri);
  expect(project.documentCount).toBe(1);

  project.removeDocument(documentWithNoRefs.uri);
  expect(project.documentCount).toBe(0);
});

test("can remove multiple times without effect", () => {
  expect(project.documentCount).toBe(3);

  project.removeDocument(document.uri);
  expect(project.documentCount).toBe(2);

  project.removeDocument(document.uri);
  expect(project.documentCount).toBe(2);

  project.removeDocument(document.uri);
  expect(project.documentCount).toBe(2);

  project.removeDocument(document.uri);
  expect(project.documentCount).toBe(2);
});

test("can get declaration", () => {
  const declaration = project.getDeclaration({
    textDocument: { uri: "test" },
    position: { line: 5, character: 32 },
  });

  expect(declaration!.uri).toBe("test");
  expect(document.getText(declaration!.range)).toBe(".. _some-ref:");
});

test("can get declaration across files", () => {
  const declaration = project.getDeclaration({
    textDocument: { uri: "test2" },
    position: { line: 0, character: 52 },
  });
  expect(declaration!.uri).toBe("test");
  expect(document.getText(declaration!.range)).toBe(".. _some-ref:");
});

test("finds no declaration for invalid cursor", () => {
  // Declaration lookup for something else
  const declaration = project.getDeclaration({
    textDocument: { uri: "test2" },
    position: { line: 0, character: 0 },
  });
  expect(declaration).toBeNull();
});

test("doesn't get confused by non-refs with ref names", () => {
  // Declaration lookup for non-ref that looks like a ref (i.e. "some-ref"
  // rather than ":ref:`some-ref`"
  const declaration = project.getDeclaration({
    textDocument: { uri: "test3" },
    position: { line: 0, character: 0 },
  });
  expect(declaration).toBeNull();
});

test("removing documents updates declarations", () => {
  expect(project.documentCount).toBe(3);
  let declaration = project.getDeclaration({
    textDocument: { uri: "test2" },
    position: { line: 0, character: 52 },
  });
  expect(declaration!.uri).toBe("test");
  expect(document.getText(declaration!.range)).toBe(".. _some-ref:");
  project.removeDocument(document.uri);
  expect(project.documentCount).toBe(2);
  declaration = project.getDeclaration({
    textDocument: { uri: "test2" },
    position: { line: 0, character: 52 },
  });
  expect(declaration).toBeNull();
});

test("can get references without declaration", () => {
  const references = project.getReferences({
    textDocument: { uri: "test" },
    position: { line: 5, character: 32 },
    context: { includeDeclaration: false },
  });

  expect(references!.length).toBe(2);
});

test("can get references with declaration includes", () => {
  const references = project.getReferences({
    textDocument: { uri: "test" },
    position: { line: 5, character: 32 },
    context: { includeDeclaration: true },
  });

  expect(references!.length).toBe(3);
});

test("can get references with cursor on the declaration", () => {
  const references = project.getReferences({
    textDocument: { uri: "test" },
    position: { line: 3, character: 5 },
    context: { includeDeclaration: false },
  });
  expect(references!.length).toBe(2);
});

test("can't get references with invalid uri", () => {
  const references = project.getReferences({
    textDocument: { uri: "fake" },
    position: { line: 5, character: 32 },
    context: { includeDeclaration: true },
  });

  expect(references).toBeNull();
});

test("no references for unreferenced entity", () => {
  const unreferencedEntityDocument = TextDocument.create(
    "unreferencedEntityDocument",
    "",
    0,
    ".. _nobody-references-this:"
  );
  project.updateDocument(unreferencedEntityDocument);
  const declaration = project.getDeclaration({
    textDocument: { uri: "unreferencedEntityDocument" },
    position: { line: 0, character: 4 },
  });
  expect(declaration).toBeDefined();
  let references = project.getReferences({
    textDocument: { uri: "unreferencedEntityDocument" },
    position: { line: 0, character: 4 },
    context: { includeDeclaration: false },
  });
  expect(references).toBeNull();
  references = project.getReferences({
    textDocument: { uri: "unreferencedEntityDocument" },
    position: { line: 0, character: 4 },
    context: { includeDeclaration: true },
  });
  expect(references!.length).toBe(1);
});

test("removing documents updates references", () => {
  expect(project.documentCount).toBe(3);
  let references = project.getReferences({
    textDocument: { uri: "test2" },
    position: { line: 0, character: 52 },
    context: { includeDeclaration: false },
  });
  expect(references!.length).toBe(2);
  expect(document.getText(references![0].range)).toBe(":ref:`some-ref`");
  project.removeDocument(document.uri);
  expect(project.documentCount).toBe(2);
  references = project.getReferences({
    textDocument: { uri: "test2" },
    position: { line: 0, character: 52 },
    context: { includeDeclaration: false },
  });
  expect(references!.length).toBe(1);
});

describe("completions", () => {
  beforeEach(() => {
    const newDocument = TextDocument.create(
      "newDocument",
      "",
      0,
      "I am :ref:`typing..."
    );
    project.updateDocument(newDocument);
  });

  test("can get completions when in ref block", () => {
    const completions = project.getCompletions({
      textDocument: { uri: "newDocument" },
      position: { line: 0, character: 11 },
    });
    expect(completions!.length).toBe(1);
  });

  test("can not get completions when not in ref block", () => {
    const completions = project.getCompletions({
      textDocument: { uri: "newDocument" },
      position: { line: 0, character: 0 },
    });
    expect(completions).toBeNull();
  });

  test("can't get completions with invalid uri'", () => {
    const completions = project.getCompletions({
      textDocument: { uri: "fake" },
      position: { line: 0, character: 0 },
    });
    expect(completions).toBeNull();
  });
});

test("can get document links", () => {
  const links = project.getDocumentLinks({
    textDocument: { uri: "test" },
  });
  expect(links!.length).toBe(1);
  expect(document.getText(links![0].range)).toBe(":ref:`some-ref`");
});

test("doesn't find document links in document without refs", () => {
  const links = project.getDocumentLinks({
    textDocument: { uri: documentWithNoRefs.uri },
  });
  expect(links).toBeNull();
});
