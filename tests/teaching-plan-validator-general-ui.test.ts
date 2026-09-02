import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("el validador final aplica el mismo semaforo y acciones a todos los controles del Plan", async () => {
  const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");

  const codes = [
    "OUTCOMES",
    "WEEKS",
    "CONTENTS",
    "HOURS",
    "ACTIVITY_HOURS",
    "EVALUATION",
    "TOTALS",
    "METHODOLOGY",
    "INSTRUMENTS",
    "QUESTION_BANKS",
    "TEMPLATE",
  ];

  assert.ok(app.includes("const teachingPlanReviewCheckRegistry"));
  for (const code of codes) assert.ok(app.includes(`${code}:`), `falta registrar ${code}`);

  assert.ok(app.includes('check?.state === "warning"'));
  assert.ok(app.includes('check?.state === "error"'));
  assert.ok(app.includes('return check?.ok ? "ok" : "error"'));
  assert.ok(app.includes("check?.blocking !== false"));
  assert.ok(app.includes("data-review-check-target"));
  assert.ok(app.includes("data-open-question-bank"));
});
