import assert from "node:assert/strict";
import test from "node:test";

import {
  adminAcademicReportFilename,
  adminAcademicReportRowMatches,
  daysInAcademicReportState,
  deriveGuideReportStatus,
  deriveTeachingPlanReportStatus,
  parseAdminAcademicReportFilters,
  type AdminAcademicReportRow,
} from "../src/services/admin-academic-report.js";

test("interpreta los filtros del reporte administrativo", () => {
  const filters = parseAdminAcademicReportFilters(new URLSearchParams({
    document: "GUIDE",
    search: "Álgebra",
    period: "2026-2",
    career: "Educación",
    modality: "En línea",
    status: "IN_REVIEW",
    stage: "QUALITY",
    dateFrom: "2026-08-01",
    dateTo: "2026-08-31",
  }));
  assert.equal(filters.document, "GUIDE");
  assert.equal(filters.search, "Álgebra");
  assert.equal(filters.stage, "QUALITY");
});

test("deriva el estado del Plan Docente sin duplicar estado persistido", () => {
  assert.deepEqual(deriveTeachingPlanReportStatus({ hasPlan: false }), { code: "NOT_GENERATED", label: "No generado" });
  assert.equal(deriveTeachingPlanReportStatus({ hasPlan: true }).code, "IN_PREPARATION");
  assert.equal(deriveTeachingPlanReportStatus({ hasPlan: true, teacherConfirmedAt: new Date(), workflowStatus: "CHANGES_REQUESTED" }).code, "CHANGES_REQUESTED");
  assert.equal(deriveTeachingPlanReportStatus({ hasPlan: true, teacherConfirmedAt: new Date(), workflowStatus: "APPROVED" }).code, "APPROVED");
});

test("deriva el estado global de revisión de la Guía", () => {
  assert.equal(deriveGuideReportStatus({ projectStatus: "DRAFT", latestStageDecisions: {} }).code, "DRAFT");
  assert.equal(deriveGuideReportStatus({ projectStatus: "COMPLETED", latestStageDecisions: {} }).code, "READY_FOR_REVIEW");
  assert.equal(deriveGuideReportStatus({ projectStatus: "COMPLETED", latestStageDecisions: { PEER: "APPROVED" } }).code, "IN_REVIEW");
  assert.equal(deriveGuideReportStatus({ projectStatus: "COMPLETED", latestStageDecisions: { PEER: "APPROVED", QUALITY: "CHANGES_REQUESTED" } }).code, "CHANGES_REQUESTED");
  assert.equal(deriveGuideReportStatus({ projectStatus: "COMPLETED", latestStageDecisions: { PEER: "APPROVED", QUALITY: "APPROVED", DIITEP: "APPROVED" } }).code, "APPROVED");
});

test("filtra por carrera, modalidad, estado, etapa, fechas y búsqueda sin tildes", () => {
  const row: AdminAcademicReportRow = {
    projectId: "p",
    subjectCode: "MAT-01",
    subjectName: "Álgebra lineal",
    professorName: "Ana Pérez",
    academicLevel: "Grado",
    academicUnit: "Facultad de Ciencias",
    career: "Educación",
    modality: "En línea",
    academicPeriod: "2026-2",
    statusCode: "IN_REVIEW",
    statusLabel: "En revisión",
    stageCode: "QUALITY",
    stageLabel: "Equipo de calidad",
    reviewerName: "Revisor",
    lastReviewAt: null,
    approvedAt: null,
    updatedAt: "2026-08-15T10:00:00.000Z",
    stateChangedAt: "2026-08-14T10:00:00.000Z",
    daysInState: 1,
  };
  const filters = parseAdminAcademicReportFilters(new URLSearchParams({
    document: "PLAN",
    search: "algebra",
    career: "Educación",
    modality: "En línea",
    status: "IN_REVIEW",
    stage: "QUALITY",
    dateFrom: "2026-08-01",
    dateTo: "2026-08-31",
  }));
  assert.equal(adminAcademicReportRowMatches(row, filters), true);
  filters.modality = "Presencial";
  assert.equal(adminAcademicReportRowMatches(row, filters), false);
});

test("calcula días en el estado actual", () => {
  assert.equal(daysInAcademicReportState("2026-08-10T00:00:00.000Z", new Date("2026-08-15T23:59:59.000Z")), 5);
});

test("genera nombres diferenciados para los dos reportes", () => {
  const now = new Date("2026-08-19T05:00:00.000Z");
  assert.equal(adminAcademicReportFilename("PLAN", now), "reporte-plan-docente-2026-08-19.xlsx");
  assert.equal(adminAcademicReportFilename("GUIDE", now), "reporte-guia-didactica-2026-08-19.xlsx");
});
