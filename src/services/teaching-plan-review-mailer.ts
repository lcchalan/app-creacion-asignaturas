import { sendPlainTextEmail } from "./smtp-mailer.js";
import { teachingPlanReviewStageLabel, type TeachingPlanReviewStage } from "../academic/teaching-plan-review-workflow.js";

export type TeachingPlanWorkflowMailEvent =
  | "SUBMITTED"
  | "RESUBMITTED"
  | "CHANGES_REQUESTED"
  | "STAGE_APPROVED"
  | "FINAL_APPROVED"
  | "INFORMATIONAL_CORRECTIONS"
  | "INFORMATIONAL_RESUBMISSION";

export function buildTeachingPlanWorkflowMail(input: {
  event: TeachingPlanWorkflowMailEvent;
  recipientName: string;
  subjectName: string;
  subjectCode: string;
  professorName: string;
  academicPeriod: string;
  career: string;
  stage?: TeachingPlanReviewStage | null;
  actorName?: string;
  observations?: string;
  reviewUrl?: string;
}) {
  const greeting = input.recipientName.trim() ? `Hola ${input.recipientName.trim()},` : "Hola,";
  const stageLabel = input.stage ? teachingPlanReviewStageLabel[input.stage] : "Revisión institucional";
  const context = [
    `Asignatura: ${input.subjectCode ? `${input.subjectCode} — ` : ""}${input.subjectName}`,
    `Profesor: ${input.professorName}`,
    `Carrera: ${input.career}`,
    `Periodo académico: ${input.academicPeriod}`,
  ];
  const observations = input.observations?.trim()
    ? ["", "Observaciones:", input.observations.trim()]
    : [];
  const reviewLink = input.reviewUrl
    ? ["", "Acceso al sistema:", input.reviewUrl]
    : [];

  if (input.event === "SUBMITTED") {
    return {
      subject: `Plan Docente pendiente de revisión - ${input.subjectName}`,
      body: [greeting, "", `Tiene un Plan Docente pendiente como ${stageLabel}.`, "", ...context, ...reviewLink, "", "Sistema de Gestión Guía didáctica"].join("\n"),
    };
  }
  if (input.event === "RESUBMITTED") {
    return {
      subject: `Plan Docente corregido para nueva revisión - ${input.subjectName}`,
      body: [greeting, "", `El profesor ha remitido nuevamente el Plan Docente con correcciones para la etapa ${stageLabel}.`, "", ...context, ...reviewLink, "", "Sistema de Gestión Guía didáctica"].join("\n"),
    };
  }
  if (input.event === "CHANGES_REQUESTED") {
    return {
      subject: `Correcciones solicitadas en el Plan Docente - ${input.subjectName}`,
      body: [greeting, "", `${input.actorName || stageLabel} ha solicitado correcciones en el Plan Docente.`, "", ...context, ...observations, ...reviewLink, "", "Sistema de Gestión Guía didáctica"].join("\n"),
    };
  }
  if (input.event === "INFORMATIONAL_CORRECTIONS") {
    return {
      subject: `Información sobre correcciones del Plan Docente - ${input.subjectName}`,
      body: [greeting, "", `${input.actorName || stageLabel} ha solicitado correcciones al profesor. Este mensaje es informativo; no se requiere una nueva aprobación de su parte.`, "", ...context, ...observations, "", "Sistema de Gestión Guía didáctica"].join("\n"),
    };
  }
  if (input.event === "INFORMATIONAL_RESUBMISSION") {
    return {
      subject: `Plan Docente corregido y reenviado - ${input.subjectName}`,
      body: [greeting, "", `El profesor ha remitido las correcciones solicitadas para la etapa ${stageLabel}. Este mensaje es informativo; su aprobación anterior permanece vigente y no se requiere una nueva aprobación de su parte.`, "", ...context, ...observations, "", "Sistema de Gestión Guía didáctica"].join("\n"),
    };
  }
  if (input.event === "FINAL_APPROVED") {
    return {
      subject: `Plan Docente aprobado - ${input.subjectName}`,
      body: [greeting, "", "El Plan Docente completó satisfactoriamente todas las etapas activas del proceso institucional de revisión y aprobación.", "", ...context, "", "Sistema de Gestión Guía didáctica"].join("\n"),
    };
  }
  return {
    subject: `Etapa aprobada del Plan Docente - ${input.subjectName}`,
    body: [greeting, "", `${input.actorName || stageLabel} aprobó la etapa ${stageLabel} del Plan Docente.`, "", ...context, "", "Sistema de Gestión Guía didáctica"].join("\n"),
  };
}

export async function sendTeachingPlanWorkflowEmail(input: { to: string; subject: string; body: string }) {
  await sendPlainTextEmail(input);
}
