import {
  DocumentUri,
  TextDocument,
  Diagnostic,
  DiagnosticSeverity,
} from "vscode-languageserver";
import deepEqual = require("deep-equal");
import { Entity, Name } from "./Entity";
import { findLabels } from "./findLabels";
import { findReferences } from "./findReferences";

// Entities represents the collection of entities in documents.
export class Entities {
  get declarations(): Entity[] {
    return Array.from(this._declarations, ([_k, entity]) => entity);
  }

  get size(): number {
    return this._declarations.size + this._references.size;
  }

  getEntitiesInDocument = (uri: DocumentUri): Entity[] | undefined => {
    return this._entitiesByDocument.get(uri);
  };

  getDeclaration = (name: Name): Entity | undefined => {
    return this._declarations.get(name);
  };

  getReferences = (name: Name): Entity[] | undefined => {
    return this._references.get(name);
  };

  // Scans the given document for labels, adds them to the entities collection,
  // and returns any diagnostics.
  addDocumentLabels = (document: TextDocument): Diagnostic[] => {
    const diagnostics: Diagnostic[] = [];
    findLabels(document).forEach((label) => {
      const diagnostic = this.add(label);
      if (diagnostic) {
        diagnostics.push(diagnostic);
      }
    });
    return diagnostics;
  };

  // Scans the given document for references, adds them to the entities
  // collection, and returns any diagnostics.
  addDocumentReferences = (document: TextDocument): Diagnostic[] => {
    const diagnostics: Diagnostic[] = [];
    findReferences(document).forEach((reference) => {
      const diagnostic = this.add(reference);
      if (diagnostic) {
        diagnostics.push(diagnostic);
      }
    });
    return diagnostics;
  };

  // Delete all existing entities previously found in this document
  // in case declarations were removed entirely.
  onDocumentRemoved = (uri: DocumentUri): boolean => {
    const previousEntities = this._entitiesByDocument.get(uri) ?? [];
    previousEntities.forEach(this.remove);
    return this._entitiesByDocument.delete(uri);
  };

  // Adds the entity to the collection or reports an error.
  add = (entity: Entity): Diagnostic | undefined => {
    const { location, name, type } = entity;
    if (type === "rst.label") {
      const existingDeclaration = this.getDeclaration(name);
      if (
        existingDeclaration &&
        !deepEqual(existingDeclaration.location, location)
      ) {
        // Duplicate label
        return {
          severity: DiagnosticSeverity.Error,
          message: `Duplicate label: ${name}`,
          source: "snoot",
          range: location.range,
          relatedInformation: [
            {
              location: existingDeclaration.location,
              message: "First declared here",
            },
          ],
        };
      }
      this._declarations.set(name, entity);
    } else {
      if (!this.getDeclaration(name)) {
        // Unknown label
        return {
          severity: DiagnosticSeverity.Error,
          range: entity.location.range,
          message: `Unknown label: ${name}`,
          source: "snoot",
        };
      }
      if (!this._references.get(name)) {
        this._references.set(name, []);
      }
      this._references.get(name)!.push(entity);
    }

    const { uri } = entity.location;
    if (!this._entitiesByDocument.has(uri)) {
      this._entitiesByDocument.set(uri, []);
    }
    this._entitiesByDocument.get(uri)!.push(entity);
  };

  remove = (entity: Entity): boolean => {
    if (entity.type === "rst.label") {
      return this._declarations.delete(entity.name);
    }

    const { uri } = entity.location;

    const refsInOtherFiles = this._references
      .get(entity.name)
      ?.filter((ref) => ref.location.uri !== uri);

    if (!refsInOtherFiles) {
      return false;
    }

    if (refsInOtherFiles.length === 0) {
      // Last reference in the entities collection.
      // Remove the entry entirely.
      this._references.delete(entity.name);
      return true;
    }

    // Replace the references array without this file's references.
    this._references.set(entity.name, refsInOtherFiles);
    return true;
  };

  private _declarations = new Map<Name, Entity>();
  private _references = new Map<Name, Entity[]>();
  private _entitiesByDocument = new Map<DocumentUri, Entity[]>();
}
