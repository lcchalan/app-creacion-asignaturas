import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const client = readFileSync("public/app.js", "utf8");

test("los campos del instrumento no se rerenderizan al intentar editarlos", () => {
  const start = client.indexOf('$("#teaching-plan-instrument-criteria")?.addEventListener("click"');
  const end = client.indexOf('$("#teaching-plan-instrument-criteria")?.addEventListener("input"', start);
  assert.ok(start >= 0 && end > start, "No se pudo localizar el manejador de criterios del instrumento.");
  const handler = client.slice(start, end);

  assert.match(handler, /if \(!removeCriterion && !addLevel && !removeLevel\) return;/);
  assert.match(handler, /renderTeachingPlanInstrumentCriteria\(\);/);
});

test("al agregar un criterio el nuevo campo recibe el foco", () => {
  const start = client.indexOf('$("#teaching-plan-add-criterion")?.addEventListener("click"');
  const end = client.indexOf('$("#teaching-plan-instrument-criteria")?.addEventListener("click"', start);
  assert.ok(start >= 0 && end > start, "No se pudo localizar la acción para agregar criterios.");
  const handler = client.slice(start, end);

  assert.match(handler, /const newCriterionIndex = current\.length - 1;/);
  assert.match(handler, /newCriterion\?\.focus\(\);/);
  assert.match(handler, /newCriterion\?\.select\(\);/);
});
