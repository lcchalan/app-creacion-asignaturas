import assert from "node:assert/strict";
import test from "node:test";
import {
  assertDateWindow,
  assertPeriodRange,
  catalogRemovalMode,
  isCatalogKind,
  normalizeCatalogCode,
  projectOfferingSyncMode,
} from "../src/academic/catalog-policy.js";

test("normaliza códigos institucionales de forma estable", () => {
  assert.equal(normalizeCatalogCode("  maestría en educación  "), "MAESTRIA-EN-EDUCACION");
  assert.equal(normalizeCatalogCode("REL_1105"), "REL_1105");
});

test("reconoce únicamente los catálogos administrables", () => {
  assert.equal(isCatalogKind("programs"), true);
  assert.equal(isCatalogKind("subject-types"), true);
  assert.equal(isCatalogKind("departments"), true);
  assert.equal(isCatalogKind("users"), false);
});

test("valida el orden de fechas de un periodo", () => {
  assert.doesNotThrow(() => assertPeriodRange(
    new Date("2026-10-01T00:00:00.000Z"),
    new Date("2027-02-28T00:00:00.000Z"),
  ));
  assert.throws(() => assertPeriodRange(
    new Date("2027-03-01T00:00:00.000Z"),
    new Date("2027-02-28T00:00:00.000Z"),
  ), /debe ser posterior/);
});

test("elimina catálogos sin uso y desactiva los que tienen historial", () => {
  assert.equal(catalogRemovalMode(0), "DELETE");
  assert.equal(catalogRemovalMode(1), "DEACTIVATE");
  assert.equal(catalogRemovalMode(25), "DEACTIVATE");
});


test("sincroniza un proyecto borrador cuando cambia la oferta académica", () => {
  assert.equal(projectOfferingSyncMode({
    snapshotChanged: true,
    hasTeachingPlan: false,
    hasGuideContent: false,
  }), "SYNC_DRAFT");
});

test("conserva la versión institucional si el plan o la guía ya fueron generados", () => {
  assert.equal(projectOfferingSyncMode({
    snapshotChanged: true,
    hasTeachingPlan: true,
    hasGuideContent: false,
  }), "REQUIRE_NEW_VERSION");
  assert.equal(projectOfferingSyncMode({
    snapshotChanged: true,
    hasTeachingPlan: false,
    hasGuideContent: true,
  }), "REQUIRE_NEW_VERSION");
});

test("no altera el proyecto cuando la oferta no cambió", () => {
  assert.equal(projectOfferingSyncMode({
    snapshotChanged: false,
    hasTeachingPlan: false,
    hasGuideContent: false,
  }), "NO_CHANGE");
});

test("valida intervalos de evaluación bimestral y recuperación", () => {
  assert.doesNotThrow(() => assertDateWindow(
    new Date("2026-11-27T00:00:00.000Z"),
    new Date("2026-12-01T00:00:00.000Z"),
    "Evaluación bimestral",
  ));
  assert.doesNotThrow(() => assertDateWindow(
    new Date("2027-02-10T00:00:00.000Z"),
    new Date("2027-02-10T00:00:00.000Z"),
    "Evaluación de recuperación",
  ));
  assert.throws(() => assertDateWindow(
    new Date("2027-02-12T00:00:00.000Z"),
    new Date("2027-02-10T00:00:00.000Z"),
    "Evaluación de recuperación",
  ), /no puede ser anterior/);
});
