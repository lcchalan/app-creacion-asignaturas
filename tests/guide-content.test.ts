import assert from "node:assert/strict";
import test from "node:test";
import {
  assembleGuideWeekMarkdown,
  buildGuideWeekOutline,
  educationalResourceSchema,
  educationalResourceToMarkdown,
  institutionalResourceComplexity,
  markdownToStructuredGuideContent,
  normalizeGuideRichTextForExport,
} from "../src/academic/guide-content.js";

const hierarchy = {
  units: [{
    id: "u1",
    title: "ANÁLISIS ESTRATÉGICO",
    contents: [{
      id: "c1",
      text: "Entorno y diagnóstico organizacional",
      subcontents: [{ id: "s1", text: "Factores internos y externos" }],
    }],
  }],
};

test("numera Unidad, tema y subtema desde la jerarquía institucional", () => {
  const outline = buildGuideWeekOutline(hierarchy, [
    "UNIDAD: ANÁLISIS ESTRATÉGICO",
    "CONTENIDO: Entorno y diagnóstico organizacional",
    "SUBCONTENIDO: Factores internos y externos",
  ]);
  assert.deepEqual(outline.map((item) => [item.role, item.number, item.text]), [
    ["unit", "1", "Análisis estratégico"],
    ["topic", "1.1", "Entorno y diagnóstico organizacional"],
    ["subtopic", "1.1.1", "Factores internos y externos"],
  ]);
});

test("el sistema añade los encabezados y la IA solo desarrolla el cuerpo", () => {
  const outline = buildGuideWeekOutline(hierarchy, ["CONTENIDO: Entorno y diagnóstico organizacional"]);
  const markdown = assembleGuideWeekMarkdown(outline, {
    sections: outline.filter((item) => item.develop).map((item) => ({ sourceId: item.sourceId, markdown: `Desarrollo de ${item.number}.` })),
  });
  assert.match(markdown, /## Unidad 1: Análisis estratégico/);
  assert.match(markdown, /### 1\.1\. Entorno y diagnóstico organizacional/);
  assert.doesNotMatch(markdown, /CONTENIDO:/i);
});

test("convierte Markdown de la guía en bloques identificables para API", () => {
  const content = markdownToStructuredGuideContent(
    "## Unidad 1: Análisis estratégico\n\n### 1.1. Entorno\n\n#### 1.1.1. Factores internos y externos\n\nTexto **clave** con https://example.edu.\n\n> [!TIP] Analice con criterio\n> Compare evidencia interna y externa.\n\n- Uno\n- Dos\n\n| A | B |\n| --- | --- |\n| 1 | 2 |",
    1,
  );
  assert.equal(content.blocks.some((block) => block.type === "heading"), true);
  assert.equal(content.blocks.some((block) => block.type === "list"), true);
  assert.equal(content.blocks.some((block) => block.type === "table"), true);
  assert.equal(content.blocks.some((block) => block.type === "heading" && block.role === "subtopic" && block.number === "1.1.1"), true);
  const callout = content.blocks.find((block) => block.type === "callout");
  assert.equal(callout?.type, "callout");
  if (callout?.type === "callout") {
    assert.equal(callout.variant, "tip");
    assert.equal(callout.content.some((item) => item.text.includes("Compare evidencia interna y externa")), true);
  }
});

test("formatea el guion de un recurso interactivo con las dos tablas institucionales", () => {
  const resource = educationalResourceSchema.parse({
    id: "resource-1",
    status: "proposed",
    bloomLevel: "ANALIZAR",
    resourceType: "STORYTELLING",
    complexity: "MEDIO",
    tool: "GENIALLY",
    title: "Historia del diagnóstico",
    purpose: "Analizar relaciones del entorno.",
    rationale: "Permite interpretar un contexto y reconocer relaciones.",
    subjectName: "Gestión Estratégica",
    subjectCode: "ADM-001",
    professorName: "Docente",
    weekNumber: 1,
    referenceResource: { url: null, description: null },
    script: { format: "interactive", screens: [{ order: 1, referenceElements: ["Imagen de organización"], contentText: "Caso inicial", productionDescription: "Animación progresiva" }] },
    bibliography: [{ reference: "Autor. (2026). Obra.", style: "APA7", sourceUrl: null }],
  });
  const markdown = educationalResourceToMarkdown(resource);
  assert.match(markdown, /\*\*Ficha del recurso\*\*/);
  assert.match(markdown, /<!-- GUIDE_RESOURCE_TABLE:FICHA -->/);
  assert.match(markdown, /\| Campo \| Información \|/);
  assert.match(markdown, /\| Nivel de Bloom \| ANALIZAR \|/);
  assert.match(markdown, /\| Tipo de recurso \| STORYTELLING \|/);
  assert.match(markdown, /\| Propósito \| Analizar relaciones del entorno\. \|/);
  assert.match(markdown, /\| Justificación pedagógica \| Permite interpretar un contexto y reconocer relaciones\. \|/);
  assert.match(markdown, /<!-- GUIDE_RESOURCE_TABLE:GUION -->/);
  assert.match(markdown, /\| Elementos de referencia \| Contenido o Texto \| Descripción \|/);
  assert.doesNotMatch(markdown, /^\*\*Nivel Bloom:/m);
  assert.doesNotMatch(markdown, /^\*\*Propósito:/m);
  assert.doesNotMatch(markdown, /^\*\*Justificación pedagógica:/m);
  assert.match(markdown, /Referencias bibliográficas del recurso \(APA 7\)/);
  const structured = markdownToStructuredGuideContent(markdown, 1, "teacher_approved");
  assert.equal(structured.resources.length, 1);
  assert.equal(structured.resources[0]?.resourceType, "STORYTELLING");
  assert.equal(structured.resources[0]?.script.format, "interactive");
  assert.equal(structured.resources[0]?.status, "teacher_approved");
  assert.equal(structured.blocks.filter((block) => block.type === "table").length, 0);
  const resourceBlock = structured.blocks.find((block) => block.type === "educational_resource");
  assert.equal(resourceBlock?.type, "educational_resource");
  if (resourceBlock?.type === "educational_resource") {
    assert.equal(resourceBlock.resourceId, structured.resources[0]?.id);
    assert.equal(resourceBlock.status, "teacher_approved");
  }
  assert.equal(institutionalResourceComplexity.STORYTELLING, "MEDIO");
});

test("solo las tablas académicas forman bloques table y las tablas internas del recurso quedan encapsuladas", () => {
  const resource = educationalResourceSchema.parse({
    id: "resource-2",
    status: "proposed",
    bloomLevel: "APLICAR",
    resourceType: "ARRASTRAR_Y_SOLTAR",
    complexity: "MEDIO",
    tool: "GENIALLY",
    title: "Clasifique los factores",
    purpose: "Aplicar criterios de clasificación.",
    rationale: "Exige usar criterios conceptuales en información concreta.",
    subjectName: "Gestión Estratégica",
    subjectCode: "ADM-001",
    professorName: "Docente",
    weekNumber: 1,
    referenceResource: { url: null, description: null },
    script: { format: "interactive", screens: [{ order: 1, referenceElements: [], contentText: "Clasifique cada elemento.", productionDescription: "Interacción de arrastre." }] },
    bibliography: [{ reference: "Autor. (2026). Obra.", style: "APA7", sourceUrl: null }],
  });
  const markdown = `## Unidad 1: Análisis estratégico\n\n| Factor | Tipo |\n| --- | --- |\n| Inflación | Externo |\n\n${educationalResourceToMarkdown(resource)}`;
  const structured = markdownToStructuredGuideContent(markdown, 1);
  assert.equal(structured.blocks.filter((block) => block.type === "table").length, 1);
  assert.equal(structured.blocks.filter((block) => block.type === "educational_resource").length, 1);
  assert.equal(structured.resources.length, 1);
});

test("normaliza HTML enriquecido de guiones antes de exportar a Word, PDF o JSON", () => {
  const normalized = normalizeGuideRichTextForExport(
    "NUEVOS ELEMENTOS<br>• Demora en actualizar el catálogo.<br><br><strong>Advertencia:</strong> no confunda correlación con causalidad.<br><em>Revise la evidencia</em> &amp; contraste fuentes.",
  );
  assert.equal(normalized.includes("<br>"), false);
  assert.equal(normalized.includes("<strong>"), false);
  assert.equal(normalized.includes("<em>"), false);
  assert.match(normalized, /NUEVOS ELEMENTOS\n• Demora en actualizar el catálogo\.\n\n\*\*Advertencia:\*\*/);
  assert.match(normalized, /\*Revise la evidencia\* & contraste fuentes\./);
});
