import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCanonicalGuide,
  CANONICAL_GUIDE_SCHEMA_VERSION,
  canonicalGuideDocumentSchema,
  canonicalGuideSchema,
  type CanonicalGuideSource,
} from "../src/canonical-guide.js";

import { educationalResourceSchema, educationalResourceToMarkdown } from "../src/academic/guide-content.js";

const approvedResourceMarkdown = educationalResourceToMarkdown(educationalResourceSchema.parse({
  id: "resource-test",
  status: "proposed",
  bloomLevel: "ANALIZAR",
  resourceType: "STORYTELLING",
  complexity: "MEDIO",
  tool: "GENIALLY",
  title: "Caso interactivo",
  purpose: "Analizar relaciones del entorno.",
  rationale: "Permite examinar relaciones en un contexto.",
  subjectName: "Diseño didáctico",
  subjectCode: "EDU-101",
  professorName: "Docente de prueba",
  weekNumber: 1,
  referenceResource: { url: null, description: null },
  script: { format: "interactive", screens: [{ order: 1, referenceElements: ["Imagen"], contentText: "Caso", productionDescription: "Animación" }] },
  bibliography: [{ reference: "Autor. (2026). Obra.", style: "APA7", sourceUrl: null }],
}));
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
    professionalProfileCompetencies: ["Diseña experiencias de aprendizaje pertinentes para educación superior."],
    graduateProfileResults: ["Integra fundamentos pedagógicos en propuestas educativas contextualizadas."],
    utplGenericCompetencies: ["Trabajo colaborativo", "Ciudadanía global"],
    basicBib: "Referencia básica — Importancia para el estudiante: Sustenta el contenido.",
    complementaryBib: "Referencia complementaria",
    reaBib: "https://example.edu/recurso",
    status: "IN_PROGRESS",
    createdAt: new Date("2026-08-06T14:00:00.000Z"),
    updatedAt: new Date("2026-08-06T15:00:00.000Z"),
  },
  matrix: {
    originalName: "matriz.xlsx",
    rows: [
      { id: "row-week-1", rowOrder: 1, weekNumber: 1, learningOutcome: "Analiza principios de diseño.", unitContent: "Unidad: DISEÑO DIDÁCTICO\nContenido: Principios", methodology: "Aprendizaje basado en problemas" },
      { id: "row-week-2", rowOrder: 2, weekNumber: 2, learningOutcome: "Aplica principios de diseño.", unitContent: "Contenido: Aplicación", methodology: "Estudio de caso" },
    ],
  },
  weeks: [
    {
      weekNumber: 1,
      status: "APPROVED",
      draftContent: "## Unidad 1: Diseño didáctico\n\n### 1.1. Principios\n\nTexto **clave** con https://example.edu.\n\n| Concepto | Descripción |\n| --- | --- |\n| Diseño | Proceso |",
      approvedContent: `## Unidad 1: Diseño didáctico\n\n### 1.1. Principios\n\nContenido **aprobado** con [fuente](https://example.edu).\n\n${approvedResourceMarkdown}`,
      approvedAt: new Date("2026-08-06T14:30:00.000Z"),
      currentVersion: 1,
    },
    { weekNumber: 2, status: "IN_REVIEW", draftContent: "### 1.2. Aplicación\n\nContenido en revisión.", approvedContent: null, approvedAt: null, currentVersion: 0 },
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

test("crea un documento canónico v3 con contenido estructurado", () => {
  const guide = buildCanonicalGuide(source);
  assert.equal(guide.schemaVersion, CANONICAL_GUIDE_SCHEMA_VERSION);
  assert.equal(guide.weeks[0]?.content.format, "structured");
  assert.equal(guide.weeks[0]?.content.approved?.blocks[0]?.type, "heading");
  assert.deepEqual(guide.weeks[0]?.sourceMatrixRowIds, ["matrix-row-1"]);
  assert.equal(guide.bibliography.format, "structured");
  assert.equal(guide.bibliography.basic[0]?.importance, "Sustenta el contenido.");
  assert.equal(guide.weeks[0]?.content.approved?.resources[0]?.status, "teacher_approved");
  assert.equal(guide.weeks[0]?.content.approved?.resources[0]?.resourceType, "STORYTELLING");
});

test("identifica negritas y enlaces dentro de los bloques v3", () => {
  const guide = buildCanonicalGuide(source);
  const paragraph = guide.weeks[0]?.content.approved?.blocks.find((block) => block.type === "paragraph");
  assert.equal(paragraph?.type, "paragraph");
  if (paragraph?.type !== "paragraph") return;
  assert.equal(paragraph.content.some((item) => item.type === "text" && item.marks.includes("bold")), true);
  assert.equal(paragraph.content.some((item) => item.type === "link" && item.href === "https://example.edu"), true);
});

test("referencia los activos y no incorpora bytes ni base64", () => {
  const guide = buildCanonicalGuide(source);
  const serialized = JSON.stringify(guide);
  assert.equal(guide.assets[0]?.storage.href, "/api/generated-images/22222222-2222-4222-8222-222222222222");
  assert.equal(serialized.includes("imageData"), false);
  assert.equal(serialized.includes("base64"), false);
});

test("rechaza referencias de matriz que no pertenecen a la semana", () => {
  const invalid = structuredClone(buildCanonicalGuide(source));
  invalid.weeks[0]!.sourceMatrixRowIds = ["matrix-row-2"];
  assert.equal(canonicalGuideSchema.safeParse(invalid).success, false);
});

test("rechaza contratos v1/v2 porque la construcción continúa únicamente con v3", () => {
  const guide = buildCanonicalGuide(source);
  const invalid = { ...guide, $schema: "/schemas/guide-canonical-v2.schema.json", schemaVersion: "2.0.0" };
  assert.equal(canonicalGuideDocumentSchema.safeParse(invalid).success, false);
});

test("rechaza competencias genéricas ajenas al catálogo UTPL", () => {
  const invalid = structuredClone(buildCanonicalGuide(source));
  invalid.metadata.academicProfile.utplGenericCompetencies = ["Competencia inventada" as never];
  assert.equal(canonicalGuideSchema.safeParse(invalid).success, false);
});
