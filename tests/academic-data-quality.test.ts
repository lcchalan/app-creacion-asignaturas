import assert from "node:assert/strict";
import test from "node:test";
import {
  assertUniqueOfferingUnitsAndContents,
  missingRequiredBibliographyTypes,
} from "../src/academic/academic-data-quality.js";

test("rechaza unidades repetidas ignorando mayúsculas, tildes y espacios", () => {
  assert.throws(() => assertUniqueOfferingUnitsAndContents([
    "UNIDAD: Gestión de información",
    "CONTENIDO: Modelo relacional",
    "UNIDAD:  gestion   de informacion ",
  ]), /No se puede repetir unidad/);
});

test("rechaza el mismo tema o contenido repetido dentro de una asignatura", () => {
  assert.throws(() => assertUniqueOfferingUnitsAndContents([
    "UNIDAD: Unidad 1",
    "CONTENIDO: Bases de datos",
    "UNIDAD: Unidad 2",
    "CONTENIDO: BASES DE DATOS",
  ]), /No se puede repetir tema o contenido/);
});

test("permite subcontenidos repetidos porque la restricción aplica a unidades y temas", () => {
  assert.doesNotThrow(() => assertUniqueOfferingUnitsAndContents([
    "UNIDAD: Unidad 1",
    "CONTENIDO: Tema A",
    "SUBCONTENIDO: Concepto",
    "UNIDAD: Unidad 2",
    "CONTENIDO: Tema B",
    "SUBCONTENIDO: Concepto",
  ]));
});

test("exige al menos bibliografía complementaria y un REA", () => {
  assert.deepEqual(missingRequiredBibliographyTypes([{ type: "BASIC" }]), ["COMPLEMENTARY", "REA"]);
  assert.deepEqual(missingRequiredBibliographyTypes([{ type: "COMPLEMENTARY" }, { type: "REA" }]), []);
});
