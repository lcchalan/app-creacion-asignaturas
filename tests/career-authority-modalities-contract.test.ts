import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);

test("las modalidades de Dirección y Secretaría se consultan desde la oferta académica del servidor", async () => {
  const [backend, frontend] = await Promise.all([
    readFile(new URL("src/index.ts", root), "utf8"),
    readFile(new URL("public/app.js", root), "utf8"),
  ]);
  assert.match(backend, /careerProgramModalitiesMatch/);
  assert.match(backend, /academicOffering\.findMany\(\{\s*where: \{ programId \}/s);
  assert.match(frontend, /\/api\/admin\/programs\/\$\{encodeURIComponent\(programId\)\}\/modalities/);
  assert.match(frontend, /La carrera no tiene modalidades en la oferta académica/);
});
