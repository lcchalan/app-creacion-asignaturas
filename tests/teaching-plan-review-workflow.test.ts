import assert from "node:assert/strict";
import test from "node:test";
import {
  nextTeachingPlanStage,
  orderedEnabledTeachingPlanStages,
  previouslyApprovedTeachingPlanStages,
  teachingPlanIndicatorPreviewSection,
  teachingPlanReviewItemNeedsCorrection,
  teachingPlanReviewWorkflowIsSuspended,
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


test("identifica los resultados de lista de cotejo que requieren corrección docente", () => {
  assert.equal(teachingPlanReviewItemNeedsCorrection("DOES_NOT_COMPLY"), true);
  assert.equal(teachingPlanReviewItemNeedsCorrection("COMPLIES_PARTIALLY"), true);
  assert.equal(teachingPlanReviewItemNeedsCorrection("COMPLIES"), false);
  assert.equal(teachingPlanReviewItemNeedsCorrection("NOT_APPLICABLE"), false);
});

test("relaciona los criterios de la lista de cotejo con la sección visible del Plan Docente", () => {
  assert.equal(teachingPlanIndicatorPreviewSection("A01"), "a");
  assert.equal(teachingPlanIndicatorPreviewSection("D04"), "d");
  assert.equal(teachingPlanIndicatorPreviewSection("E02"), "e");
  assert.equal(teachingPlanIndicatorPreviewSection("G02"), "g");
  assert.equal(teachingPlanIndicatorPreviewSection("DI01"), "d");
  assert.equal(teachingPlanIndicatorPreviewSection("DI02"), "e");
  assert.equal(teachingPlanIndicatorPreviewSection("DIR01"), "c");
  assert.equal(teachingPlanIndicatorPreviewSection("DIR02"), "h");
  assert.equal(teachingPlanIndicatorPreviewSection("Q01"), "cover");
});

test("suspende los flujos activos cuando el proceso global está desactivado", () => {
  assert.equal(teachingPlanReviewWorkflowIsSuspended(false, "IN_REVIEW"), true);
  assert.equal(teachingPlanReviewWorkflowIsSuspended(false, "CHANGES_REQUESTED"), true);
  assert.equal(teachingPlanReviewWorkflowIsSuspended(false, "APPROVED"), false);
  assert.equal(teachingPlanReviewWorkflowIsSuspended(true, "IN_REVIEW"), false);
});

test("reconoce los cuatro perfiles institucionales de revisión del Plan Docente", () => {
  assert.equal(userCanActOnTeachingPlanStage(["REVIEWER"], "PEER"), true);
  assert.equal(userCanActOnTeachingPlanStage(["QUALITY"], "QUALITY"), true);
  assert.equal(userCanActOnTeachingPlanStage(["DIITEP"], "DIITEP"), true);
  assert.equal(userCanActOnTeachingPlanStage(["DIRECTOR"], "DIRECTOR"), true);
  assert.equal(userCanActOnTeachingPlanStage(["QUALITY"], "DIITEP"), false);
  assert.equal(userCanActOnTeachingPlanStage(["DIITEP"], "DIRECTOR"), false);
  assert.equal(userCanActOnTeachingPlanStage(["ADMIN"], "QUALITY"), false);
});

test("avanza secuencialmente Par, Calidad, DIITEP y Dirección sin reabrir etapas aprobadas", () => {
  const stages = [
    { sortOrder: 1, status: "APPROVED", stage: "PEER" },
    { sortOrder: 2, status: "WAITING", stage: "QUALITY" },
    { sortOrder: 3, status: "WAITING", stage: "DIITEP" },
    { sortOrder: 4, status: "WAITING", stage: "DIRECTOR" },
  ];
  assert.equal(nextTeachingPlanStage(stages, 1)?.stage, "QUALITY");
  stages[1]!.status = "APPROVED";
  assert.equal(nextTeachingPlanStage(stages, 2)?.stage, "DIITEP");
  stages[2]!.status = "APPROVED";
  assert.equal(nextTeachingPlanStage(stages, 3)?.stage, "DIRECTOR");
  stages[3]!.status = "APPROVED";
  assert.equal(nextTeachingPlanStage(stages, 4), null);
  assert.deepEqual(previouslyApprovedTeachingPlanStages(stages, 4).map((item) => item.stage), ["PEER", "QUALITY", "DIITEP"]);
});
