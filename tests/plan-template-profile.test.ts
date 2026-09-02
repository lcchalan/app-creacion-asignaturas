import assert from "node:assert/strict";
import test from "node:test";
import JSZip from "jszip";
import { inspectPlanTemplateProfile } from "../src/academic/plan-template-profile.js";

function table(gridColumns: number, texts: string[]) {
  return `<w:tbl><w:tblGrid>${Array.from({ length: gridColumns }, () => '<w:gridCol w:w="1000"/>').join("")}</w:tblGrid><w:tr>${texts.map((text) => `<w:tc><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:tc>`).join("")}</w:tr></w:tbl>`;
}

async function fixture(
  scheduleColumns: number,
  scheduleHeaders: string[],
  evaluationColumns: number,
  evaluationHeaders: string[],
  identificationColumns = 4,
  identificationHeaders = ["Facultad", "Carrera", "Asignatura", "Código Número de créditos"],
) {
  const zip = new JSZip();
  zip.file("word/document.xml", `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${table(identificationColumns, identificationHeaders)}${table(scheduleColumns, scheduleHeaders)}${table(evaluationColumns, evaluationHeaders)}</w:body></w:document>`);
  return zip.generateAsync({ type: "uint8array" });
}

test("detecta la estructura vigente del formato modular", async () => {
  const bytes = await fixture(
    7,
    ["Semana", "Contenidos", "ACD", "APE", "AA", "Actividades de aprendizaje", "Recursos de aprendizaje"],
    7,
    ["Componente", "Actividad", "Estrategias de trabajo", "Instrumento de evaluación", "Semana ejecución*", "Calificación", "Peso"],
  );
  const profile = await inspectPlanTemplateProfile(bytes);
  assert.equal(profile.profile, "CURRENT_MODULAR");
  assert.equal(profile.scheduleIncludesInstrument, false);
  assert.equal(profile.evaluationIncludesWorkStrategies, true);
});

test("detecta el formato modular anterior de nueve columnas en programación", async () => {
  const bytes = await fixture(
    9,
    ["Semana", "Contenidos", "ACD", "APE", "AA", "Actividades de aprendizaje", "Recursos de aprendizaje", "Instrumentos de evaluación", "Calificación"],
    6,
    ["Componente", "Actividad", "Instrumento de evaluación", "Semana ejecución*", "Calificación", "Peso"],
    5,
    ["Facultad", "Carrera", "Asignatura", "Código", "Número de créditos"],
  );
  const profile = await inspectPlanTemplateProfile(bytes);
  assert.equal(profile.profile, "LEGACY_MODULAR");
  assert.equal(profile.scheduleIncludesInstrument, true);
  assert.equal(profile.scheduleIncludesGrade, true);
});

test("mapea dinámicamente el nuevo formato con instrumento y calificación en programación y entregable en evaluación", async () => {
  const bytes = await fixture(
    6,
    ["Semana", "Contenidos", "Actividades de aprendizaje", "Recursos de aprendizaje", "Instrumento de evaluación", "Clificación"],
    7,
    ["Componente", "Actividad", "Entregable", "Instrumento de evaluación", "Semana ejecución*", "Calificación", "Peso"],
    4,
    ["Facultad", "Carrera", "Asignatura", "Código Número de créditos Total horas"],
  );
  const profile = await inspectPlanTemplateProfile(bytes);
  assert.equal(profile.profile, "DYNAMIC_MODULAR");
  assert.equal(profile.identificationIncludesTotalHours, true);
  assert.deepEqual(profile.scheduleFields, ["WEEK", "CONTENTS", "ACTIVITIES", "RESOURCES", "ASSESSMENT_INSTRUMENT", "GRADE"]);
  assert.deepEqual(profile.evaluationFields, ["COMPONENT", "ACTIVITY", "DELIVERABLE", "INSTRUMENT", "WEEK", "GRADE", "WEIGHT"]);
  assert.equal(profile.evaluationIncludesDeliverable, true);
  assert.ok(profile.confidence >= 95);
});

test("el mapeo dinámico conserva el significado aunque cambie el orden físico de las columnas", async () => {
  const bytes = await fixture(
    6,
    ["Recursos de aprendizaje", "Semana", "Instrumento de evaluación", "Contenidos", "Calificación", "Actividades de aprendizaje"],
    7,
    ["Peso", "Actividad", "Semana ejecución", "Entregable", "Componente", "Instrumento de evaluación", "Calificación"],
  );
  const profile = await inspectPlanTemplateProfile(bytes);
  assert.equal(profile.profile, "DYNAMIC_MODULAR");
  assert.deepEqual(profile.scheduleFields, ["RESOURCES", "WEEK", "ASSESSMENT_INSTRUMENT", "CONTENTS", "GRADE", "ACTIVITIES"]);
  assert.deepEqual(profile.evaluationFields, ["WEIGHT", "ACTIVITY", "WEEK", "DELIVERABLE", "COMPONENT", "INSTRUMENT", "GRADE"]);
});
