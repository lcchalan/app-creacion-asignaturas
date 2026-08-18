import assert from "node:assert/strict";
import test from "node:test";
import {
  nextTeachingPlanStage,
  orderedEnabledTeachingPlanStages,
  previouslyApprovedTeachingPlanStages,
  teachingPlanReviewStageRole,
  userCanActOnTeachingPlanStage,
} from "../src/academic/teaching-plan-review-workflow.js";

test("ordena solo las etapas activas del proceso de revisión", () => {
  const stages = orderedEnabledTeachingPlanStages([
    { stage: "DIRECTOR", enabled: true, sortOrder: 4 },
    { stage: "PEER", enabled: true, sortOrder: 1 },
    { stage: "QUALITY", enabled: false, sortOrder: 2 },
    { stage: "DIITEP", enabled: true, sortOrder: 3 },
  ]);
  assert.deepEqual(stages.map((item) => item.stage), ["PEER", "DIITEP", "DIRECTOR"]);
});

test("permite que el administrador deje activo solo al par académico", () => {
  const stages = orderedEnabledTeachingPlanStages([
    { stage: "PEER", enabled: true, sortOrder: 1 },
    { stage: "QUALITY", enabled: false, sortOrder: 2 },
    { stage: "DIITEP", enabled: false, sortOrder: 3 },
    { stage: "DIRECTOR", enabled: false, sortOrder: 4 },
  ]);
  assert.deepEqual(stages.map((item) => item.stage), ["PEER"]);
});

test("rechaza dos etapas activas con el mismo orden", () => {
  assert.throws(() => orderedEnabledTeachingPlanStages([
    { stage: "PEER", enabled: true, sortOrder: 1 },
    { stage: "QUALITY", enabled: true, sortOrder: 1 },
  ]), /mismo orden/u);
});

test("mapea cada etapa al rol institucional correspondiente", () => {
  assert.deepEqual(teachingPlanReviewStageRole, {
    PEER: "REVIEWER",
    QUALITY: "QUALITY",
    DIITEP: "DIITEP",
    DIRECTOR: "DIRECTOR",
  });
  assert.equal(userCanActOnTeachingPlanStage(["TEACHER", "REVIEWER"], "PEER"), true);
  assert.equal(userCanActOnTeachingPlanStage(["TEACHER", "REVIEWER"], "QUALITY"), false);
  assert.equal(userCanActOnTeachingPlanStage(["ADMIN"], "DIRECTOR"), false);
  assert.equal(userCanActOnTeachingPlanStage(["ADMIN", "DIRECTOR"], "DIRECTOR"), true);
});

test("una corrección posterior no reactiva las etapas ya aprobadas", () => {
  const stages = [
    { sortOrder: 1, status: "APPROVED", stage: "PEER" },
    { sortOrder: 2, status: "CHANGES_REQUESTED", stage: "QUALITY" },
    { sortOrder: 3, status: "WAITING", stage: "DIITEP" },
  ];
  assert.deepEqual(previouslyApprovedTeachingPlanStages(stages, 2).map((item) => item.stage), ["PEER"]);
  assert.equal(nextTeachingPlanStage(stages, 2)?.stage, "DIITEP");
});
