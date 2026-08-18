import assert from "node:assert/strict";
import test from "node:test";
import { buildTeachingPlanWorkflowMail } from "../src/services/teaching-plan-review-mailer.js";

const context = {
  recipientName: "María Pérez",
  subjectName: "Administración Financiera",
  subjectCode: "FINZ_4057",
  professorName: "Docente de prueba",
  academicPeriod: "2026-2",
  career: "Finanzas",
  stage: "QUALITY" as const,
};

test("la notificación de correcciones informa a revisores anteriores sin pedir nueva aprobación", () => {
  const message = buildTeachingPlanWorkflowMail({
    ...context,
    event: "INFORMATIONAL_CORRECTIONS",
    actorName: "Equipo de calidad",
    observations: "Ajustar la evidencia de la actividad AC2.",
  });
  assert.match(message.subject, /Información sobre correcciones/u);
  assert.match(message.body, /no se requiere una nueva aprobación/u);
  assert.match(message.body, /Ajustar la evidencia/u);
});

test("el reenvío de correcciones conserva explícitamente las aprobaciones anteriores", () => {
  const message = buildTeachingPlanWorkflowMail({
    ...context,
    event: "INFORMATIONAL_RESUBMISSION",
    observations: "Se atendieron las observaciones registradas.",
  });
  assert.match(message.subject, /corregido y reenviado/u);
  assert.match(message.body, /aprobación anterior permanece vigente/u);
  assert.match(message.body, /no se requiere una nueva aprobación/u);
});

test("el revisor actual recibe el resumen de respuestas del docente al reenviar correcciones", () => {
  const message = buildTeachingPlanWorkflowMail({
    ...context,
    event: "RESUBMITTED",
    observations: "D02: Se redistribuyeron los contenidos entre las semanas 4 y 5.",
    reviewUrl: "https://sistema.example/revision",
  });
  assert.match(message.body, /D02: Se redistribuyeron/u);
  assert.match(message.body, /https:\/\/sistema\.example\/revision/u);
});
