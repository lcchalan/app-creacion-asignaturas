import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  evaluationRulesFor,
  evaluationRulesSchema,
} from "../src/academic/teaching-plan-policy.js";

test("las distribuciones institucionales iniciales corresponden a Conceptual, Activa e Integradora", () => {
  const expected = {
    CONCEPTUAL: [
      { code: "AC1", component: "ACD", week: 2, grade: 1, weight: 10 },
      { code: "AC2", component: "AA", week: 4, grade: 1, weight: 10 },
      { code: "AC3", component: "ACD", week: 6, grade: 3, weight: 30 },
      { code: "AC4", component: "APE", week: 7, grade: 2, weight: 20 },
      { code: "AC5", component: "AA", week: 8, grade: 3, weight: 30 },
    ],
    ACTIVE: [
      { code: "AC1", component: "ACD", week: 2, grade: 0.5, weight: 5 },
      { code: "AC2", component: "APE", week: 4, grade: 2, weight: 20 },
      { code: "AC3", component: "ACD", week: 6, grade: 1.5, weight: 15 },
      { code: "AC4", component: "APE", week: 7, grade: 3, weight: 30 },
      { code: "AC5", component: "AA", week: 8, grade: 3, weight: 30 },
    ],
    INTEGRATING: [
      { code: "AC1", component: "ACD", week: 2, grade: 1, weight: 10 },
      { code: "AC2", component: "APE", week: 4, grade: 2, weight: 20 },
      { code: "AC3", component: "ACD", week: 6, grade: 1, weight: 10 },
      { code: "AC4", component: "APE", week: 7, grade: 4, weight: 40 },
      { code: "AC5", component: "AA", week: 8, grade: 2, weight: 20 },
    ],
  } as const;

  for (const category of ["CONCEPTUAL", "ACTIVE", "INTEGRATING"] as const) {
    const rules = evaluationRulesSchema.parse(evaluationRulesFor(category));
    assert.deepEqual(rules, expected[category]);
    assert.equal(rules.reduce((sum, rule) => sum + rule.grade, 0), 10);
    assert.equal(rules.reduce((sum, rule) => sum + rule.weight, 0), 100);
  }
});

test("la configuración administrativa puede cambiar valores conservando las reglas institucionales", () => {
  const rules = evaluationRulesFor("CONCEPTUAL");
  rules[0] = { ...rules[0]!, grade: 0.8, weight: 8 };
  rules[1] = { ...rules[1]!, grade: 1.2, weight: 12 };
  assert.doesNotThrow(() => evaluationRulesSchema.parse(rules));
});

test("rechaza una versión de evaluación cuyos totales no sean 10 puntos y 100 por ciento", () => {
  const invalid = evaluationRulesFor("ACTIVE");
  invalid[0] = { ...invalid[0]!, weight: 6 };
  const result = evaluationRulesSchema.safeParse(invalid);
  assert.equal(result.success, false);
  assert.match(JSON.stringify(result.error?.issues), /100%/);
});


test("rechaza dos actividades calificadas asignadas a la misma semana", () => {
  const invalid = evaluationRulesFor("INTEGRATING");
  invalid[1] = { ...invalid[1]!, week: invalid[0]!.week };
  const result = evaluationRulesSchema.safeParse(invalid);
  assert.equal(result.success, false);
  assert.match(JSON.stringify(result.error?.issues), /semana diferente/);
});

test("el Plan Docente conserva una referencia a la versión de evaluación usada", () => {
  const schema = readFileSync(new URL("../prisma/schema.prisma", import.meta.url), "utf8");
  const server = readFileSync(new URL("../src/index.ts", import.meta.url), "utf8");
  const client = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
  assert.match(schema, /model TeachingPlanEvaluationPolicyVersion/);
  assert.match(schema, /evaluationPolicySnapshotId\s+String\?/);
  assert.match(server, /\/api\/admin\/teaching-plan-evaluation-policies/);
  assert.match(server, /projectPlanConsistencyInput\(offering, evaluationPolicy\.rules\)/);
  assert.match(client, /currentPlanEvaluationPreviewRules/);
  assert.doesNotMatch(client, /const planEvaluationPreviewRules = \{/);
});
