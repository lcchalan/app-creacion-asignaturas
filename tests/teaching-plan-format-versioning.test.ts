import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const indexSource = await readFile(new URL("../src/index.ts", import.meta.url), "utf8");
const appSource = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const htmlSource = await readFile(new URL("../public/index.html", import.meta.url), "utf8");

test("los planes históricos usan su snapshot de formato en lugar de exigir el formato activo", () => {
  assert.match(indexSource, /const snapshot = await database\.knowledgeDocument\.findUnique\(\{ where: \{ id: snapshotId \} \}\)/);
  assert.doesNotMatch(indexSource, /Regénere el Plan Docente con IA antes de revisarlo o descargarlo/);
  assert.match(indexSource, /return teachingPlanTemplateSnapshot\(snapshotId, context\)/);
});

test("un borrador puede adoptar el formato vigente sin regenerar el contenido académico", () => {
  assert.match(indexSource, /teaching-plan\\\/template\\\/upgrade/);
  assert.match(indexSource, /TEACHING_PLAN_TEMPLATE_UPGRADED/);
  assert.match(htmlSource, /id="upgrade-teaching-plan-template"/);
  assert.match(appSource, /actualizar solo el formato sin regenerar el contenido académico/);
});

test("la descarga JSON del Plan Docente entrega el documento canónico", () => {
  assert.match(indexSource, /canonicalTeachingPlanDocumentSchema\.parse\(canonicalBundle\.canonical\)/);
  assert.match(indexSource, /X-Canonical-Schema-Version/);
  assert.match(indexSource, /canonicalTeachingPlanToWordInput\(canonicalBundle\.canonical, logo\)/);
});
