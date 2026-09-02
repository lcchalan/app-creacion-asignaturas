import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { teachingPlanAiContentSchema, teachingPlanContentSchema } from "../src/academic/teaching-plan-policy.js";

const policySource = await readFile(new URL("../src/academic/teaching-plan-policy.ts", import.meta.url), "utf8");
const indexSource = await readFile(new URL("../src/index.ts", import.meta.url), "utf8");
const appSource = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const htmlSource = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
const canonicalSource = await readFile(new URL("../src/canonical-teaching-plan.ts", import.meta.url), "utf8");
const prismaSource = await readFile(new URL("../prisma/schema.prisma", import.meta.url), "utf8");

test("Entregable y estrategias de trabajo permanecen como conceptos académicos distintos", () => {
  assert.match(policySource, /deliverable:/);
  assert.match(policySource, /workStrategies:/);
  assert.match(indexSource, /El entregable indica QUÉ PRESENTA el estudiante/);
  assert.match(indexSource, /Las estrategias de trabajo indican CÓMO REALIZA el trabajo/);
  assert.match(htmlSource, /name="deliverable"/);
  assert.match(appSource, /elements\.deliverable/);
  assert.match(prismaSource, /deliverable\s+String\?/);
});

test("los planes históricos siguen siendo legibles aunque todavía no tengan entregable", () => {
  const parsed = teachingPlanContentSchema.parse({
    presentation: "Presentación académica suficientemente extensa para conservar compatibilidad histórica.",
    guideTitle: "Guía de prueba",
    guideDescription: "Descripción académica suficientemente extensa para validar compatibilidad.",
    sequences: [{
      learningOutcome: "Aplica un resultado de aprendizaje.", methodology: "Aprendizaje activo", tac: ["EVA"],
      weeks: Array.from({ length: 8 }, (_, index) => ({
        week: index + 1, unitContents: ["Unidad 1"], acdHours: 1, apeHours: 0, aaHours: 1,
        activities: ["Actividad"], activityDetails: [], resources: ["EVA"], assessmentInstrument: "Rúbrica", grade: 0,
      })),
    }],
    evaluatedActivities: ["AC1", "AC2", "AC3", "AC4", "AC5"].map((code, index) => ({
      code, component: "ACD", week: index + 1, activity: `Actividad ${code}`, workStrategies: "Siga las indicaciones.",
      instrument: "Rúbrica", grade: 2, weight: 20,
    })),
  });
  assert.ok(parsed.evaluatedActivities.every((activity) => activity.deliverable === ""));
});

test("la salida estructurada de IA exige un entregable concreto", () => {
  const evaluationSchema = teachingPlanAiContentSchema.shape.evaluatedActivities.element;
  const result = evaluationSchema.safeParse({
    code: "AC1", component: "ACD", week: 1, activity: "Analizar un caso", workStrategies: "Revise y argumente.",
    deliverable: "Informe de análisis en PDF", instrument: "Rúbrica", instrumentConfig: {
      type: "OTHER", title: "Rúbrica", maximumScore: 10, questionnaire: null, criteria: [],
    }, grade: 2, weight: 20,
  });
  assert.equal(result.success, true);
});

test("el contrato canónico incorpora horas totales derivadas y perfiles dinámicos", () => {
  assert.match(canonicalSource, /CANONICAL_TEACHING_PLAN_SCHEMA_VERSION = "1\.2\.0"/);
  assert.match(canonicalSource, /totalHours:/);
  assert.match(canonicalSource, /DYNAMIC_MODULAR/);
});
