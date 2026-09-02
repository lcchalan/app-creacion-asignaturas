import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const appSource = await readFile(new URL("../public/app.js", import.meta.url), "utf8");

test("V2 presenta Numero de creditos y Total de horas en la misma fila institucional", () => {
  assert.match(appSource, /dynamicTemplateFormat && planState\?\.templateProfile\?\.identificationIncludesTotalHours/);
  assert.match(
    appSource,
    /<tr><th>Número de créditos<\/th><td>\$\{escapeHtml\(institutionalData\?\.credits \?\? "—"\)\}<\/td><th>Total de horas<\/th><td>\$\{escapeHtml\(totalHours\)\}<\/td><\/tr>/,
  );
  assert.doesNotMatch(
    appSource,
    /<tr><th>Total horas<\/th><td colspan="3">\$\{totalHours\}<\/td><\/tr>/,
  );
});

test("los formatos sin Total de horas conservan la fila de creditos expandida", () => {
  assert.match(
    appSource,
    /<tr><th>Número de créditos<\/th><td colspan="3">\$\{escapeHtml\(institutionalData\?\.credits \?\? "—"\)\}<\/td><\/tr>/,
  );
});
