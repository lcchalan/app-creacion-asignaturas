import assert from "node:assert/strict";
import test from "node:test";
import JSZip from "jszip";
import { inspectPlanTemplateProfile } from "../src/academic/plan-template-profile.js";

function table(gridColumns: number, texts: string[]) {
  return `<w:tbl><w:tblGrid>${Array.from({ length: gridColumns }, () => '<w:gridCol w:w="1000"/>').join("")}</w:tblGrid><w:tr>${texts.map((text) => `<w:tc><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:tc>`).join("")}</w:tr></w:tbl>`;
}

async function fixture(scheduleColumns: number, scheduleHeaders: string[], evaluationColumns: number, evaluationHeaders: string[], identificationColumns = 4) {
  const zip = new JSZip();
  zip.file("word/document.xml", `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${table(identificationColumns, ["Facultad", "Carrera", "Asignatura", "Número de créditos"])}${table(scheduleColumns, scheduleHeaders)}${table(evaluationColumns, evaluationHeaders)}</w:body></w:document>`);
  return zip.generateAsync({ type: "uint8array" });
}

test("detecta la estructura vigente del formato modular", async () => {
  const bytes = await fixture(7, ["Semana", "Contenidos", "ACD", "APE", "AA", "Actividades de aprendizaje", "Recursos de aprendizaje"], 7, ["Componente", "Actividad", "Estrategias de trabajo", "Instrumento de evaluación", "Semana ejecución*", "Calificación", "Peso"]);
  const profile = await inspectPlanTemplateProfile(bytes);
  assert.equal(profile.profile, "CURRENT_MODULAR");
  assert.equal(profile.scheduleIncludesInstrument, false);
  assert.equal(profile.evaluationIncludesWorkStrategies, true);
});

test("detecta el formato modular anterior de nueve columnas en programación", async () => {
  const bytes = await fixture(9, ["Semana", "Contenidos", "ACD", "APE", "AA", "Actividades de aprendizaje", "Recursos de aprendizaje", "Instrumentos de evaluación", "Calificación"], 6, ["Componente", "Actividad", "Instrumento de evaluación", "Semana ejecución*", "Calificación", "Peso"], 5);
  const profile = await inspectPlanTemplateProfile(bytes);
  assert.equal(profile.profile, "LEGACY_MODULAR");
  assert.equal(profile.scheduleIncludesInstrument, true);
  assert.equal(profile.scheduleIncludesGrade, true);
});
