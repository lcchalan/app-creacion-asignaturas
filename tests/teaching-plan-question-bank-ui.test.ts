import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
const client = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const server = await readFile(new URL("../src/index.ts", import.meta.url), "utf8");
const styles = await readFile(new URL("../public/styles.css", import.meta.url), "utf8");

test("Administración configura el mínimo institucional del banco de preguntas", () => {
  assert.match(html, /id="question-bank-settings-form"/);
  assert.match(html, /id="question-bank-minimum"/);
  assert.match(client, /TEACHING_PLAN_QUESTION_BANK_MINIMUM_QUESTIONS/);
  assert.match(server, /\/api\/admin\/settings\/question-bank/);
});

test("el profesor configura tipos, temas y regeneración IA del banco", () => {
  assert.match(html, /id="question-bank-modal"/);
  assert.match(html, /id="question-bank-topics"/);
  assert.match(html, /id="question-bank-types"/);
  assert.match(html, /id="question-bank-instructions"/);
  assert.match(client, /data-question-regenerate/);
  assert.match(client, /Regenerar banco con IA/);
});

test("el backend exige bancos aprobados antes de confirmar un Plan con cuestionarios", () => {
  assert.match(server, /assertTeachingPlanQuestionnaireBanksReady/);
  assert.match(server, /Apruebe el banco de preguntas del cuestionario/);
  assert.match(server, /TEACHING_PLAN_QUESTION_BANK_APPROVED/);
});

test("los bancos históricos se conservan en PostgreSQL y el canónico solo publica cuestionarios vigentes", () => {
  assert.match(server, /currentQuestionnaireCodes/);
  assert.match(server, /questionBanks\.filter\(\(bank\) => currentQuestionnaireCodes\.has\(bank\.evaluatedCode\)\)/);
  assert.match(server, /status: "NEEDS_REVIEW", approvedAt: null/);
});


test("la configuración visual del banco usa dos columnas sin desperdiciar espacio", () => {
  assert.match(html, /academic-config-question-bank-card/);
  assert.match(html, /question-bank-types-section/);
  assert.match(client, /questionBankTopicDisplayLabel/);
  assert.match(client, /question-bank-type-quantity/);
  assert.match(styles, /question-bank-type-list\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/s);
  assert.match(styles, /@media \(max-width:\s*900px\)[\s\S]*?question-bank-type-list\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  assert.match(styles, /academic-config-grid\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/s);
});


test("el banco presenta numeración académica, clave visual y cierre al aprobar", () => {
  assert.match(client, /questionBankTopicDisplayMap/);
  assert.match(client, /questionBankTopicDisplayLabel\(question\.topic\)/);
  assert.match(client, /correct-answer/);
  assert.match(styles, /question-bank-option-row\.correct-answer/);
  assert.match(client, /showMessage\("Banco guardado\."\)/);
  const bankSavedAt = client.indexOf('showMessage("Banco guardado.");');
  const validationRefreshAt = client.indexOf("refreshTeachingPlanReviewReadiness", bankSavedAt);
  const bankClosedAt = client.indexOf("closeQuestionBankModal();", bankSavedAt);
  assert.ok(bankSavedAt >= 0);
  assert.ok(bankClosedAt > bankSavedAt);
  if (validationRefreshAt >= 0) assert.ok(bankClosedAt > validationRefreshAt);
});

test("el docente puede responder correcciones sin volver al inicio del Plan", () => {
  assert.match(html, /id="teacher-correction-companion"/);
  assert.match(html, /id="teacher-correction-companion-next"/);
  assert.match(client, /activateTeacherCorrection/);
  assert.match(client, /goToNextTeacherCorrection/);
  assert.match(styles, /teacher-correction-companion\s*\{[^}]*position:\s*fixed/s);
});

test("la revalidación del par conserva criterios ya aprobados y solo reabre los observados", () => {
  assert.match(server, /teachingPlanReviewResultCanCarryForward/);
  assert.match(server, /previousCorrectionReview/);
  assert.match(client, /item\.carriedForward/);
  assert.match(client, /Calificación conservada/);
  assert.match(styles, /review-checklist-item\.carried-forward/);
});
