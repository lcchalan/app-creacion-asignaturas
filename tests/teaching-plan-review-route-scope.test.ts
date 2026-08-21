import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const server = await readFile(new URL("../src/index.ts", import.meta.url), "utf8");

function routeSlice(startMarker: string, endMarker: string) {
  const start = server.indexOf(startMarker);
  assert.notEqual(start, -1, `No se encontró el inicio de ruta: ${startMarker}`);
  const end = server.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(end, -1, `No se encontró el final de ruta: ${endMarker}`);
  return server.slice(start, end);
}

test("la conservación de criterios pertenece solo a la revisión del Plan Docente", () => {
  const guideChecklistPatch = routeSlice(
    'const checklistMatch = requestUrl.pathname.match(/^\\/api\\/admin\\/checklists',
    'if (request.method === "GET" && requestUrl.pathname === "/api/projects")',
  );
  assert.doesNotMatch(guideChecklistPatch, /previousCorrectionReview/);
  assert.doesNotMatch(guideChecklistPatch, /workflowStageId/);
  assert.doesNotMatch(guideChecklistPatch, /teachingPlanReviewResultCanCarryForward/);

  const teachingPlanReviewPatch = routeSlice(
    'const teachingPlanReviewerDecisionMatch = requestUrl.pathname.match(/^\\/api\\/teaching-plan\\/reviews',
    'const guideReadinessMatch = requestUrl.pathname.match(',
  );
  assert.match(teachingPlanReviewPatch, /previousCorrectionReview/);
  assert.match(teachingPlanReviewPatch, /workflowStageId:\s*workflowStage\.id/);
  assert.match(teachingPlanReviewPatch, /teachingPlanReviewResultCanCarryForward/);
});
