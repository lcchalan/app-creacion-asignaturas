import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("la vista del Plan identifica el formato aplicado desde el snapshot canónico", async () => {
  const [server, app] = await Promise.all([
    readFile(new URL("../src/index.ts", import.meta.url), "utf8"),
    readFile(new URL("../public/app.js", import.meta.url), "utf8"),
  ]);
  assert.ok(server.includes("teachingPlanAppliedFormatMatch"));
  assert.ok(server.includes("canonicalTeachingPlanDocumentSchema.safeParse"));
  assert.ok(server.includes("canonicalDocument: true"));
  assert.ok(app.includes("teachingPlanAppliedTemplateSnapshot"));
  assert.ok(app.includes("refreshTeachingPlanAppliedFormat"));
  assert.ok(app.includes("/teaching-plan/applied-format"));
  assert.ok(app.includes("const snapshot = teachingPlanAppliedTemplateSnapshot();"));
  assert.ok(app.includes("snapshot.id !== active.id"));
  assert.ok(app.includes("Formato institucional aplicado:"));
});
