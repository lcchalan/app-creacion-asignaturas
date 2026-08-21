import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const serverSource = await readFile(new URL("../src/index.ts", import.meta.url), "utf8");
const clientSource = await readFile(new URL("../public/app.js", import.meta.url), "utf8");

test("la Guia se genera desde el Plan Docente persistido y no desde una copia redundante del navegador", () => {
  assert.match(serverSource, /const guideGenerationClientSchema = z\.object\(\{[\s\S]*projectId: z\.string\(\)\.uuid\(\)[\s\S]*week: z\.number\(\)/);
  assert.match(serverSource, /const authoritativeRows = planMatrixRows\(teachingPlan\)/);
  assert.match(serverSource, /const authoritativeProject = offeringSnapshot\(planSource\.academicOffering\)/);
  assert.match(serverSource, /professionalProfileCompetencies: uniqueText\(mappingValidation\.data\.flatMap\(\(item\) => item\.professionalCompetencies\)\)/);
  assert.match(serverSource, /guideReferenceImportance: planSource\.guideReferenceImportance \|\| buildDidacticGuideImportance/);
  assert.match(serverSource, /const generation = authoritativeValidation\.data/);
  assert.match(serverSource, /issue\.path\.length \? issue\.path\.join\("\.\"\)/);
});

test("el navegador envia solo la identidad de la asignatura y el contexto de regeneracion", () => {
  const start = clientSource.indexOf('async function generationPayload(adjustmentInstructions = "")');
  const end = clientSource.indexOf("\nfunction updateWeekInterface()", start);
  assert.ok(start >= 0 && end > start, "No se encontro generationPayload");
  const block = clientSource.slice(start, end);
  assert.match(block, /projectId,/);
  assert.match(block, /week: currentWeek/);
  assert.doesNotMatch(block, /matrixRows/);
  assert.doesNotMatch(block, /bibliography:/);
  assert.doesNotMatch(block, /professionalProfileCompetencies/);
});
