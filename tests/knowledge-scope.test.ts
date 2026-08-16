import assert from "node:assert/strict";
import test from "node:test";
import { appliesToKnowledgeContext, appliesToKnowledgeProcess, knowledgeScopeMismatches } from "../src/academic/knowledge-scope.js";

const baseScope = {
  academicLevels: ["Grado"],
  modalities: ["En línea"],
  durations: [8],
  subjectTypes: ["Tipo A - Conceptual"],
};

const baseContext = {
  level: "Grado",
  modality: "En línea",
  weeks: 8,
  subjectType: "TA-AC",
  subjectTypeLabel: "Tipo A - Conceptual",
};

test("aplica un documento cuando coincide el nombre del tipo aunque el proyecto conserve su código", () => {
  assert.equal(appliesToKnowledgeContext(baseScope, baseContext), true);
});

test("mantiene compatibilidad con códigos y nombres parciales históricos", () => {
  assert.equal(appliesToKnowledgeContext({ ...baseScope, subjectTypes: ["TA-AC"] }, baseContext), true);
  assert.equal(appliesToKnowledgeContext({ ...baseScope, subjectTypes: ["Proyecto o integradora"] }, { ...baseContext, subjectType: "PROYECTO", subjectTypeLabel: "Proyecto o integradora" }), true);
});

test("detecta una modalidad incompatible", () => {
  assert.equal(appliesToKnowledgeContext({ ...baseScope, modalities: ["Presencial"] }, baseContext), false);
  assert.deepEqual(knowledgeScopeMismatches({ ...baseScope, modalities: ["Presencial"] }, baseContext), ["modalidad «En línea»"]);
});

test("un ámbito vacío se aplica a cualquier contexto", () => {
  assert.equal(appliesToKnowledgeContext({ academicLevels: [], modalities: [], durations: [], subjectTypes: [] }, baseContext), true);
});

test("los mensajes muestran el nombre legible del tipo", () => {
  assert.deepEqual(
    knowledgeScopeMismatches({ ...baseScope, subjectTypes: ["Tipo B - Activa"] }, baseContext),
    ["tipo de asignatura «Tipo A - Conceptual»"],
  );
});


test("una especificación solo se aplica a los procesos configurados", () => {
  const scope = { processes: ["PLAN_ADAPTATION"] };
  assert.equal(appliesToKnowledgeProcess(scope, "PLAN_ADAPTATION"), true);
  assert.equal(appliesToKnowledgeProcess(scope, "PLAN_GENERATION"), false);
  assert.equal(appliesToKnowledgeProcess(scope, "GUIDE_ADAPTATION"), false);
});

test("las especificaciones históricas sin procesos conservan compatibilidad con la guía", () => {
  const scope = { processes: [] };
  assert.equal(appliesToKnowledgeProcess(scope, "GUIDE_GENERATION"), true);
  assert.equal(appliesToKnowledgeProcess(scope, "GUIDE_ADAPTATION"), true);
  assert.equal(appliesToKnowledgeProcess(scope, "PLAN_ADAPTATION"), false);
});
