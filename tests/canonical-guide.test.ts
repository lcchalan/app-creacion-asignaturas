import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCanonicalGuide,
  CANONICAL_GUIDE_SCHEMA_VERSION,
  canonicalGuideSchema,
  type CanonicalGuideSource,
} from "../src/canonical-guide.js";

const source: CanonicalGuideSource = {
  project: {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Guía de prueba",
    level: "Grado",
    faculty: "Facultad de Educación",
    career: "Educación",
    professorName: "Docente de prueba",
    subjectCode: "EDU-101",
    subjectName: "Diseño didáctico",
    subjectType: "GENERAL",
    modality: "En línea",
    academicPeriod: "Octubre 2026 - Febrero 2027",
    totalWeeks: 2,
    basicBib: "Referencia básica",
    complementaryBib: "Referencia complementaria",
    reaBib: "https://example.edu/recurso",
    status: "IN_PROGRESS",
    createdAt: new Date("2026-08-06T14:00:00.000Z"),
    updatedAt: new Date("2026-08-06T15:00:00.000Z"),
  },
  matrix: {
    originalName: "matriz.xlsx",
    rows: [
      {
        id: "row-week-1",
        rowOrder: 1,
        weekNumber: 1,
        learningOutcome: "Analiza principios de diseño.",
        unitContent: "Unidad 1. Diseño didáctico\nTema 1. Principios",
        methodology: "Aprendizaje basado en problemas",
      },
      {
        id: "row-week-2",
        rowOrder: 2,
        weekNumber: 2,
        learningOutcome: "Aplica principios de diseño.",
        unitContent: "Unidad 1. Diseño didáctico\nTema 2. Aplicación",
        methodology: "Estudio de caso",
      },
    ],
  },
  weeks: [
    {
      weekNumber: 1,
      status: "APPROVED",
      draftContent: "# Semana 1",
      approvedContent: "# Semana 1\n\nContenido aprobado.",
      approvedAt: new Date("2026-08-06T14:30:00.000Z"),
      currentVersion: 1,
    },
    {
      weekNumber: 2,
      status: "IN_REVIEW",
      draftContent: "# Semana 2\n\nContenido en revisión.",
      approvedContent: null,
      approvedAt: null,
      currentVersion: 0,
    },
  ],
  generatedImages: [
    {
      id: "22222222-2222-4222-8222-222222222222",
      weekNumber: 1,
      figureNumber: 1,
      title: "Proceso de diseño",
      altText: "Diagrama del proceso de diseño didáctico.",
      source: "Elaboración propia mediante IA",
      prompt: "Representar el proceso de diseño didáctico.",
      style: "Académico",
      mimeType: "image/png",
    },
  ],
};

test("crea un documento canónico v1 sin alterar el contenido literal", () => {
  const guide = buildCanonicalGuide(source);

  assert.equal(guide.schemaVersion, CANONICAL_GUIDE_SCHEMA_VERSION);
  assert.equal(
    guide.planning.sourceMatrix.rows[0]?.unitContentLiteral,
    source.matrix?.rows[0]?.unitContent,
  );
  assert.equal(guide.weeks[0]?.content.format, "markdown");
  assert.equal(guide.weeks[0]?.content.approved, "# Semana 1\n\nContenido aprobado.");
  assert.deepEqual(guide.weeks[0]?.sourceMatrixRowIds, ["matrix-row-1"]);
});

test("referencia los activos y no incorpora bytes ni base64", () => {
  const guide = buildCanonicalGuide(source);
  const serialized = JSON.stringify(guide);

  assert.equal(guide.assets[0]?.storage.href, "/api/generated-images/22222222-2222-4222-8222-222222222222");
  assert.equal(guide.assets[0]?.fileName, "assets/images/22222222-2222-4222-8222-222222222222.png");
  assert.equal(serialized.includes("imageData"), false);
  assert.equal(serialized.includes("base64"), false);
});

test("rechaza referencias de matriz que no pertenecen a la semana", () => {
  const guide = buildCanonicalGuide(source);
  const invalid = structuredClone(guide);
  invalid.weeks[0]!.sourceMatrixRowIds = ["matrix-row-2"];

  const result = canonicalGuideSchema.safeParse(invalid);
  assert.equal(result.success, false);
});

test("rechaza versiones de contrato desconocidas", () => {
  const guide = buildCanonicalGuide(source);
  const invalid = { ...guide, schemaVersion: "2.0.0" };

  const result = canonicalGuideSchema.safeParse(invalid);
  assert.equal(result.success, false);
});
