import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const indexSource = await readFile(new URL("../src/index.ts", import.meta.url), "utf8");

test("la consulta principal del proyecto incluye el documento canonico del Plan Docente", () => {
  const start = indexSource.indexOf("const projectMatch = requestUrl.pathname.match");
  const end = indexSource.indexOf("const currentTeachingPlanContent", start);
  assert.ok(start >= 0 && end > start, "No se encontro el bloque GET /api/projects/:id");
  const block = indexSource.slice(start, end);
  const canonicalSelect = block.match(
    /canonicalDocument:\s*\{\s*select:\s*\{([^}]*)\}\s*\}/,
  );
  assert.ok(canonicalSelect, "La consulta debe incluir canonicalDocument.select");
  assert.match(canonicalSelect[1], /schemaVersion:\s*true/);
  assert.match(canonicalSelect[1], /updatedAt:\s*true/);
});
