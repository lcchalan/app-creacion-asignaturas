import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const client = readFileSync("public/app.js", "utf8");
const server = readFileSync("src/index.ts", "utf8");

test("responsables del Plan pueden asignarse antes de generar el TeachingPlan", () => {
  const start = client.indexOf("function renderPlanReviewAdmin()");
  const end = client.indexOf('$("#plan-review-project")?.addEventListener', start);
  assert.ok(start >= 0 && end > start, "No se pudo localizar renderPlanReviewAdmin en public/app.js");
  const assignmentRenderer = client.slice(start, end);

  assert.match(assignmentRenderer, /const projects = adminData\.projects;/);
  assert.match(assignmentRenderer, /\$\("#plan-review-project"\)\.innerHTML/);
  assert.doesNotMatch(assignmentRenderer, /const projects = adminData\.projects\.filter\(\(project\) => project\.teachingPlan\)/);
  assert.match(server, /TEACHING_PLAN_REVIEWERS_ASSIGNED/);
});

test("el selector de responsables distingue carrera y modalidad", () => {
  assert.match(client, /academicOffering\?\.program\?\.name/);
  assert.match(client, /academicOffering\?\.modality\?\.name/);
  assert.match(server, /modality: \{ select: \{ id: true, name: true \} \}/);
});
