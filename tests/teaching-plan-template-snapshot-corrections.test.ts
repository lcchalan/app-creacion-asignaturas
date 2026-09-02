import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const serverFile = new URL("../src/index.ts", import.meta.url);

test("las correcciones conservan el snapshot de formato del ciclo institucional", async () => {
  const server = await readFile(serverFile, "utf8");
  const generateStart = server.indexOf('if (request.method === "POST" && teachingPlanGenerateMatch)');
  const generateEnd = server.indexOf('const teachingPlanMatch = requestUrl.pathname.match', generateStart);
  assert.ok(generateStart >= 0 && generateEnd > generateStart);
  const generate = server.slice(generateStart, generateEnd);

  assert.ok(server.includes('async function activePlanContext(context: PromptContext, templateSnapshotId: string | null = null)'));
  assert.ok(server.includes('? await teachingPlanTemplateSnapshot(templateSnapshotId, context)'));
  assert.ok(generate.includes('teachingPlan: { include: { reviewWorkflow: true } }'));
  assert.ok(generate.includes('project.teachingPlan.teacherReviewedAt || project.teachingPlan.reviewWorkflow'));
  assert.ok(generate.includes('activePlanContext(context, lockedTemplateSnapshotId)'));
  assert.ok(generate.includes('const resolvedTemplateSnapshotId = lockedTemplateSnapshotId || planContext.template.id;'));
  assert.equal((generate.match(/templateSnapshotId: resolvedTemplateSnapshotId/g) || []).length, 2);
});

test("la regeneracion responde con snapshot aplicado y formato vigente separados", async () => {
  const server = await readFile(serverFile, "utf8");
  const generateStart = server.indexOf('if (request.method === "POST" && teachingPlanGenerateMatch)');
  const generateEnd = server.indexOf('const teachingPlanMatch = requestUrl.pathname.match', generateStart);
  const generate = server.slice(generateStart, generateEnd);

  assert.ok(generate.includes('const canonicalBundle = await buildAndPersistCanonicalTeachingPlan(project.id);'));
  assert.ok(generate.includes('templateSnapshot: canonicalBundle.canonical.format.snapshot'));
  assert.ok(generate.includes('activeTemplate: canonicalBundle.canonical.format.active'));
  assert.ok(generate.includes('templateOutdated: canonicalBundle.canonical.format.outdated'));
});

test("la adaptacion del mismo ciclo reutiliza el snapshot historico", async () => {
  const server = await readFile(serverFile, "utf8");
  const adaptationStart = server.indexOf('if (request.method === "POST" && adaptationAnalyzeMatch)');
  const adaptationEnd = server.indexOf('const teachingPlanGenerateMatch = requestUrl.pathname.match', adaptationStart);
  assert.ok(adaptationStart >= 0 && adaptationEnd > adaptationStart);
  const adaptation = server.slice(adaptationStart, adaptationEnd);

  assert.ok(adaptation.includes('teachingPlan: { include: { reviewWorkflow: true } }'));
  assert.ok(adaptation.includes('project.teachingPlan.teacherReviewedAt || project.teachingPlan.reviewWorkflow'));
  assert.ok(adaptation.includes('activePlanContext(context, lockedTemplateSnapshotId)'));
  assert.ok(adaptation.includes('templateSnapshotId = planContext.template.id'));
});

test("el upgrade explicito sigue bloqueado cuando el formato ya fue fijado", async () => {
  const server = await readFile(serverFile, "utf8");
  assert.ok(server.includes('if (project.teachingPlan.teacherReviewedAt || project.teachingPlan.reviewWorkflow)'));
  assert.ok(server.includes('Los planes históricos conservan su formato original.'));
});
