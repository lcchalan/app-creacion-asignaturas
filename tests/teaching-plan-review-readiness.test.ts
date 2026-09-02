import assert from "node:assert/strict";
import test from "node:test";
import { teachingPlanQuestionBankReadinessCheck } from "../src/academic/teaching-plan-review-readiness.js";

const questionnaire = {
  code: "AC1",
  week: 2,
  activity: "Resolver cuestionario de aplicación",
  questionnaireQuestionCount: 10,
  authorizedTopics: ["CONTENIDO: Tema 1", "CONTENIDO: Tema 2"],
};

test("no agrega control de bancos cuando el Plan no usa cuestionarios", () => {
  assert.equal(teachingPlanQuestionBankReadinessCheck({
    questionnaires: [],
    banks: [],
    institutionalMinimum: 20,
  }), null);
});

test("marca en rojo un cuestionario sin banco de preguntas", () => {
  const check = teachingPlanQuestionBankReadinessCheck({
    questionnaires: [questionnaire],
    banks: [],
    institutionalMinimum: 20,
  });
  assert.equal(check?.ok, false);
  assert.equal(check?.state, "error");
  assert.equal(check?.blocking, true);
  assert.equal(check?.items[0]?.status, "MISSING");
  assert.equal(check?.items[0]?.requiredMinimum, 20);
});

test("mantiene pendiente un banco generado pero no aprobado", () => {
  const check = teachingPlanQuestionBankReadinessCheck({
    questionnaires: [questionnaire],
    banks: [{
      evaluatedCode: "AC1",
      status: "GENERATED",
      questionCount: 20,
      minimumRequired: 20,
      topicScope: ["CONTENIDO: Tema 1"],
    }],
    institutionalMinimum: 20,
  });
  assert.equal(check?.ok, false);
  assert.equal(check?.items[0]?.status, "NOT_APPROVED");
});

test("detecta un banco incompleto aunque tenga estado aprobado", () => {
  const check = teachingPlanQuestionBankReadinessCheck({
    questionnaires: [questionnaire],
    banks: [{
      evaluatedCode: "AC1",
      status: "APPROVED",
      questionCount: 12,
      minimumRequired: 20,
      topicScope: ["CONTENIDO: Tema 1"],
    }],
    institutionalMinimum: 20,
  });
  assert.equal(check?.ok, false);
  assert.equal(check?.items[0]?.status, "INCOMPLETE");
});

test("detecta alcance tematico desactualizado", () => {
  const check = teachingPlanQuestionBankReadinessCheck({
    questionnaires: [questionnaire],
    banks: [{
      evaluatedCode: "AC1",
      status: "APPROVED",
      questionCount: 20,
      minimumRequired: 20,
      topicScope: ["CONTENIDO: Tema retirado"],
    }],
    institutionalMinimum: 20,
  });
  assert.equal(check?.ok, false);
  assert.equal(check?.items[0]?.status, "NEEDS_REVIEW");
});

test("pasa a verde cuando todos los bancos de cuestionarios estan aprobados y vigentes", () => {
  const check = teachingPlanQuestionBankReadinessCheck({
    questionnaires: [questionnaire],
    banks: [{
      evaluatedCode: "AC1",
      status: "APPROVED",
      questionCount: 20,
      minimumRequired: 20,
      topicScope: ["CONTENIDO: Tema 1", "CONTENIDO: Tema 2"],
    }],
    institutionalMinimum: 20,
  });
  assert.equal(check?.ok, true);
  assert.equal(check?.state, "ok");
  assert.equal(check?.items[0]?.status, "APPROVED");
});
