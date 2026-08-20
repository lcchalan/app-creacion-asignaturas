import assert from "node:assert/strict";
import test from "node:test";
import {
  aiUsageSnapshot,
  describeManagedAiRequest,
  managedAiPath,
  normalizeAiGenerationLimit,
} from "../src/ai/ai-generation-policy.js";

test("clasifica las operaciones IA y conserva el alcance por contenido", () => {
  assert.deepEqual(
    describeManagedAiRequest("POST", "/api/projects/11111111-1111-1111-1111-111111111111/teaching-plan/generate", undefined),
    {
      operation: "TEACHING_PLAN_GENERATION",
      targetKey: "project:11111111-1111-1111-1111-111111111111:teaching-plan",
      projectId: "11111111-1111-1111-1111-111111111111",
      label: "Generación del Plan Docente",
    },
  );
  const week = describeManagedAiRequest("POST", "/api/generate-week", {
    projectId: "22222222-2222-2222-2222-222222222222",
    week: 4,
  });
  assert.equal(week?.targetKey, "project:22222222-2222-2222-2222-222222222222:guide-week:4");
  assert.equal(week?.operation, "GUIDE_WEEK_GENERATION");
});

test("no clasifica rutas ajenas a generación IA", () => {
  assert.equal(managedAiPath("GET", "/api/projects"), false);
  assert.equal(managedAiPath("POST", "/api/auth/login"), false);
});

test("el límite cero significa sin límite y las reservas evitan exceder el cupo", () => {
  assert.deepEqual(aiUsageSnapshot(0, 25, 3), {
    limit: 0, used: 25, reserved: 3, unlimited: true, remaining: null, canRequest: true,
  });
  assert.equal(aiUsageSnapshot(3, 2, 1).canRequest, false);
  assert.equal(aiUsageSnapshot(3, 1, 1).remaining, 1);
});

test("normaliza límites inválidos al valor predeterminado", () => {
  assert.equal(normalizeAiGenerationLimit("5"), 5);
  assert.equal(normalizeAiGenerationLimit(-1), 3);
  assert.equal(normalizeAiGenerationLimit(101), 3);
});
