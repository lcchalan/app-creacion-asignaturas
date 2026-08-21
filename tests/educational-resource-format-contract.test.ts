import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import {
  audiovisualEducationalResourceSchema,
  interactiveEducationalResourceSchema,
} from "../src/academic/guide-content.js";

const baseResource = {
  id: "resource-contract",
  status: "proposed" as const,
  bloomLevel: "APLICAR" as const,
  resourceType: "STORYTELLING" as const,
  complexity: "MEDIO" as const,
  tool: "GENIALLY" as const,
  title: "Recurso de prueba",
  purpose: "Aplicar el contenido de estudio.",
  rationale: "Permite comprobar el contrato del recurso.",
  subjectName: "Asignatura de prueba",
  subjectCode: "TEST-001",
  professorName: "Docente",
  weekNumber: 1,
  referenceResource: { url: null, description: null },
  bibliography: [{ reference: "Autor. (2026). Obra.", style: "APA7" as const, sourceUrl: null }],
};

test("el contrato de recurso interactivo no acepta un guion audiovisual", () => {
  const interactive = interactiveEducationalResourceSchema.safeParse({
    ...baseResource,
    script: {
      format: "interactive",
      screens: [{ order: 1, referenceElements: [], contentText: "Contenido", productionDescription: "Interacción" }],
    },
  });
  assert.equal(interactive.success, true);

  const audiovisual = interactiveEducationalResourceSchema.safeParse({
    ...baseResource,
    script: {
      format: "audiovisual",
      hook: "Inicio",
      development: "Desarrollo",
      motivationalClosing: "Cierre",
      scenes: [{ order: 1, referenceElements: [], voiceOver: "Voz", onScreenText: "Texto", productionDescription: "Toma" }],
    },
  });
  assert.equal(audiovisual.success, false);
});

test("el contrato audiovisual no acepta un guion interactivo", () => {
  const audiovisual = audiovisualEducationalResourceSchema.safeParse({
    ...baseResource,
    resourceType: "VIDEO",
    tool: "VIDEO_CORTO",
    script: {
      format: "audiovisual",
      hook: "Inicio",
      development: "Desarrollo",
      motivationalClosing: "Cierre",
      scenes: [{ order: 1, referenceElements: [], voiceOver: "Voz", onScreenText: "Texto", productionDescription: "Toma" }],
    },
  });
  assert.equal(audiovisual.success, true);

  const interactive = audiovisualEducationalResourceSchema.safeParse({
    ...baseResource,
    resourceType: "VIDEO",
    tool: "VIDEO_CORTO",
    script: {
      format: "interactive",
      screens: [{ order: 1, referenceElements: [], contentText: "Contenido", productionDescription: "Interacción" }],
    },
  });
  assert.equal(interactive.success, false);
});

test("la generación selecciona el esquema estructurado según el formato esperado", async () => {
  const source = await readFile(new URL("../src/index.ts", import.meta.url), "utf8");
  assert.match(source, /const generationSchema = scriptFormat === "audiovisual"[\s\S]*audiovisualEducationalResourceSchema[\s\S]*interactiveEducationalResourceSchema/);
  assert.match(source, /zodTextFormat\(generationSchema, "educational_resource"\)/);
  assert.match(source, /const generated = generationSchema\.parse\(/);
});
