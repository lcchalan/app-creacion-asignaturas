import assert from "node:assert/strict";
import test from "node:test";
import {
  assertResourceKindMatchesTitle,
  preferredKnowledgeVersion,
  preferredSingularKnowledgeVersion,
  suggestedResourceKind,
} from "../src/academic/knowledge-lifecycle.js";

test("detecta el formato del Plan Docente por su título", () => {
  assert.equal(suggestedResourceKind("Formato Plan Docente Sistema Modular"), "PLAN_TEMPLATE");
});

test("detecta los prompts del plan y de la guía", () => {
  assert.equal(suggestedResourceKind("Prompt del plan docente"), "PLAN_PROMPT");
  assert.equal(suggestedResourceKind("Prompt para la Guía Didáctica"), "GUIDE_PROMPT");
});

test("rechaza una configuración evidente con un tipo de recurso incorrecto", () => {
  assert.throws(
    () => assertResourceKindMatchesTitle("Formato Plan Docente Sistema Modular", "INSTITUTIONAL_DOCUMENT"),
    /Formato del Plan Docente/,
  );
});

test("no fuerza el tipo cuando el título no permite inferirlo", () => {
  assert.doesNotThrow(() => assertResourceKindMatchesTitle("Lineamientos del Sistema Modular", "INSTITUTIONAL_DOCUMENT"));
});

test("prefiere la versión activa más reciente cuando existen formatos compatibles con la misma prioridad", () => {
  const older = { priority: 10, activatedAt: new Date("2026-08-10T10:00:00Z"), version: 2, name: "Formato v2" };
  const newer = { priority: 10, activatedAt: new Date("2026-08-14T10:00:00Z"), version: 3, name: "Formato v3" };
  assert.equal(preferredKnowledgeVersion([older, newer])?.name, "Formato v3");
});


test("un formato nuevo reemplaza al anterior aunque cambie la prioridad de aplicación", () => {
  const older = { priority: 1, activatedAt: new Date("2026-08-10T10:00:00Z"), version: 2, name: "Formato anterior" };
  const newer = { priority: 99, activatedAt: new Date("2026-08-14T10:00:00Z"), version: 4, name: "Formato vigente" };
  assert.equal(preferredSingularKnowledgeVersion([older, newer])?.name, "Formato vigente");
});
