import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("la validacion docente expone estados, bancos accionables y confirmacion academica clara", async () => {
  const [app, html, css, server] = await Promise.all([
    readFile(new URL("../public/app.js", import.meta.url), "utf8"),
    readFile(new URL("../public/index.html", import.meta.url), "utf8"),
    readFile(new URL("../public/styles.css", import.meta.url), "utf8"),
    readFile(new URL("../src/index.ts", import.meta.url), "utf8"),
  ]);

  assert.ok(server.includes("const teachingPlanValidationMatch = requestUrl.pathname.match("));
  assert.ok(server.includes("teachingPlanQuestionBankReadinessCheck"));
  assert.ok(app.includes("QUESTION_BANKS"));
  assert.ok(app.includes("data-open-question-bank"));
  assert.ok(app.includes("function teachingPlanReviewCheckState(check)"));
  assert.ok(app.includes('class="teaching-plan-review-check ${state}"'));
  assert.ok(app.includes("checkBlocksTeachingPlanReview"));
  assert.ok(html.includes("Observaciones de la revisión docente"));
  assert.ok(html.includes("Confirmo que he revisado el contenido académico del Plan Docente"));
  assert.ok(css.includes("v33.0.3 · validación final del Plan Docente"));
  assert.ok(css.includes(".teaching-plan-review-check.warning"));
  assert.ok(css.includes(".teaching-plan-review-check.error"));
  assert.ok(css.includes(".teaching-plan-review-check.ok"));  assert.ok(app.includes("teachingPlanReviewCheckRegistry"));
  assert.ok(app.includes("data-review-check-target"));
  assert.ok(app.includes("checkBlocksTeachingPlanReview"));

});
