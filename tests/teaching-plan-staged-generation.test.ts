import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const schema = readFileSync("prisma/schema.prisma", "utf8");
const server = readFileSync("src/index.ts", "utf8");
const client = readFileSync("public/app.js", "utf8");
const html = readFileSync("public/index.html", "utf8");

test("el Plan Docente conserva aprobaciones separadas de metodología y planificación", () => {
  assert.match(schema, /methodologyApprovedAt\s+DateTime\?/);
  assert.match(schema, /planningApprovedAt\s+DateTime\?/);
});

test("la planificación se genera usando metodología y TAC aprobadas", () => {
  assert.match(server, /METODOLOGÍA Y TAC APROBADAS POR EL PROFESOR/);
  assert.match(server, /generationOptions\.mode === "PLANNING"/);
  assert.match(client, /#approve-plan-methodologies/);
  assert.match(client, /generateTeachingPlanStage\("PLANNING", "", \{ button \}\)/);
  assert.match(client, /Metodología y TAC aprobadas\. La planificación semanal fue generada/);
});

test("la evaluación se habilita solo después de aprobar la planificación", () => {
  assert.match(server, /teaching-plan\\\/planning\\\/approve/);
  assert.match(server, /Apruebe primero la metodología\/TAC y la planificación semanal/);
  assert.match(client, /sectionE\.classList\.toggle\("hidden", !planningApproved\)/);
});


test("la actividad evaluada usa la planificación semanal como fuente única", () => {
  assert.match(html, /type="hidden" name="evaluatedActivity"/);
  assert.match(client, /const linkedEvaluatedDetail = evaluatedCode \? activityDetails\.find/);
  assert.match(client, /activity: linkedEvaluatedDetail\?\.description \|\| ""/);
  assert.match(client, /return evaluated \? \{ \.\.\.detail, description: evaluated\.activity \} : detail/);
  assert.match(server, /activity: linkedEvaluationDetail\?\.description \|\| body\.evaluatedActivity\.activity/);
  assert.match(server, /description: linkedEvaluation\?\.week === week\.week \? linkedEvaluation\.activity : detail\.description/);
});

test("el flujo del Plan muestra acciones contextuales y lleva a la siguiente etapa", () => {
  assert.match(html, /id="teaching-plan-stage-progress"/);
  assert.match(html, /Generar metodología y TAC con IA/);
  assert.match(client, /id="plan-planning-approval-slot"/);
  assert.match(client, /scrollToTeachingPlanTarget\("#plan-preview-d"\)/);
  assert.match(client, /scrollToTeachingPlanTarget\("#plan-preview-e"\)/);
  assert.match(client, /generatePlanButton\.classList\.toggle\("hidden", Boolean\(teachingPlanState\)\)/);
});
