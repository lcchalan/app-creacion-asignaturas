import * as XLSX from "xlsx";

import { database } from "../db/client.js";

export type AdminAcademicReportDocument = "PLAN" | "GUIDE";

export type AdminAcademicReportFilters = {
  document: AdminAcademicReportDocument;
  search: string;
  period: string;
  career: string;
  modality: string;
  status: string;
  stage: string;
  dateFrom: string;
  dateTo: string;
};

export type AdminAcademicReportRow = {
  projectId: string;
  subjectCode: string;
  subjectName: string;
  professorName: string;
  academicLevel: string;
  academicUnit: string;
  career: string;
  modality: string;
  academicPeriod: string;
  statusCode: string;
  statusLabel: string;
  stageCode: string;
  stageLabel: string;
  reviewerName: string;
  lastReviewAt: string | null;
  approvedAt: string | null;
  updatedAt: string;
  stateChangedAt: string;
  daysInState: number;
  planVersion?: number | null;
  teacherConfirmedAt?: string | null;
  approvedWeeks?: number;
  totalWeeks?: number;
  progressPercent?: number;
  preparationStatus?: string;
};

export type AdminAcademicReportResult = {
  document: AdminAcademicReportDocument;
  filters: AdminAcademicReportFilters;
  generatedAt: string;
  summary: {
    total: number;
    byStatus: Array<{ code: string; label: string; count: number }>;
  };
  options: {
    periods: string[];
    careers: string[];
    modalities: string[];
    statuses: Array<{ code: string; label: string }>;
    stages: Array<{ code: string; label: string }>;
  };
  rows: AdminAcademicReportRow[];
};

const planStageLabels: Record<string, string> = {
  PEER: "Par académico",
  QUALITY: "Equipo de calidad",
  DIITEP: "DIITEP",
  DIRECTOR: "Dirección de carrera",
};

const guideStageLabels: Record<string, string> = {
  PEER: "Par académico",
  QUALITY: "Equipo de calidad",
  DIITEP: "DIITEP",
};

const guideStageOrder = ["PEER", "QUALITY", "DIITEP"];

function clean(value: string | null | undefined) {
  return String(value || "").trim();
}

function normalized(value: string | null | undefined) {
  return clean(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es");
}

function iso(value: Date | string | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function latestIso(values: Array<Date | string | null | undefined>) {
  const dates = values
    .map((value) => iso(value))
    .filter((value): value is string => Boolean(value))
    .sort();
  return dates.at(-1) || null;
}

export function daysInAcademicReportState(value: Date | string | null | undefined, now = new Date()) {
  const date = value instanceof Date ? value : value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return 0;
  return Math.max(0, Math.floor((now.getTime() - date.getTime()) / 86_400_000));
}

export function parseAdminAcademicReportFilters(searchParams: URLSearchParams): AdminAcademicReportFilters {
  const document = searchParams.get("document") === "GUIDE" ? "GUIDE" : "PLAN";
  return {
    document,
    search: clean(searchParams.get("search")),
    period: clean(searchParams.get("period")),
    career: clean(searchParams.get("career")),
    modality: clean(searchParams.get("modality")),
    status: clean(searchParams.get("status")),
    stage: clean(searchParams.get("stage")),
    dateFrom: clean(searchParams.get("dateFrom")),
    dateTo: clean(searchParams.get("dateTo")),
  };
}

function reportDateWithinRange(row: AdminAcademicReportRow, filters: AdminAcademicReportFilters) {
  const reference = new Date(row.updatedAt);
  if (Number.isNaN(reference.getTime())) return true;
  if (filters.dateFrom) {
    const from = new Date(`${filters.dateFrom}T00:00:00.000Z`);
    if (!Number.isNaN(from.getTime()) && reference < from) return false;
  }
  if (filters.dateTo) {
    const to = new Date(`${filters.dateTo}T23:59:59.999Z`);
    if (!Number.isNaN(to.getTime()) && reference > to) return false;
  }
  return true;
}

export function adminAcademicReportRowMatches(row: AdminAcademicReportRow, filters: AdminAcademicReportFilters) {
  if (filters.search) {
    const haystack = normalized([
      row.subjectCode,
      row.subjectName,
      row.professorName,
      row.academicLevel,
      row.academicUnit,
      row.career,
      row.modality,
      row.academicPeriod,
      row.statusLabel,
      row.stageLabel,
      row.reviewerName,
    ].join(" "));
    if (!haystack.includes(normalized(filters.search))) return false;
  }
  if (filters.period && row.academicPeriod !== filters.period) return false;
  if (filters.career && row.career !== filters.career) return false;
  if (filters.modality && row.modality !== filters.modality) return false;
  if (filters.status && row.statusCode !== filters.status) return false;
  if (filters.stage && row.stageCode !== filters.stage) return false;
  return reportDateWithinRange(row, filters);
}

export function deriveTeachingPlanReportStatus(input: {
  hasPlan: boolean;
  teacherConfirmedAt?: Date | string | null;
  workflowStatus?: string | null;
}) {
  if (!input.hasPlan) return { code: "NOT_GENERATED", label: "No generado" };
  if (!input.teacherConfirmedAt) return { code: "IN_PREPARATION", label: "En elaboración" };
  if (!input.workflowStatus) return { code: "READY_FOR_REVIEW", label: "Listo para revisión" };
  if (input.workflowStatus === "CHANGES_REQUESTED") return { code: "CHANGES_REQUESTED", label: "Correcciones solicitadas" };
  if (input.workflowStatus === "APPROVED") return { code: "APPROVED", label: "Aprobado" };
  if (input.workflowStatus === "CANCELLED") return { code: "CANCELLED", label: "Cancelado" };
  return { code: "IN_REVIEW", label: "En revisión" };
}

export function deriveGuideReportStatus(input: {
  projectStatus: string;
  latestStageDecisions: Record<string, string | undefined>;
}) {
  const decisions = guideStageOrder.map((stage) => input.latestStageDecisions[stage]);
  if (decisions.includes("CHANGES_REQUESTED")) {
    return { code: "CHANGES_REQUESTED", label: "Correcciones solicitadas" };
  }
  if (decisions.every((decision) => decision === "APPROVED")) {
    return { code: "APPROVED", label: "Aprobada" };
  }
  if (decisions.some(Boolean)) {
    return { code: "IN_REVIEW", label: "En revisión" };
  }
  if (input.projectStatus === "COMPLETED") return { code: "READY_FOR_REVIEW", label: "Lista para revisión" };
  if (input.projectStatus === "IN_PROGRESS") return { code: "IN_PREPARATION", label: "En elaboración" };
  return { code: "DRAFT", label: "Borrador" };
}

function nextGuideStage(latestStageDecisions: Record<string, string | undefined>) {
  const correctionStage = guideStageOrder.find((stage) => latestStageDecisions[stage] === "CHANGES_REQUESTED");
  if (correctionStage) return correctionStage;
  const next = guideStageOrder.find((stage) => latestStageDecisions[stage] !== "APPROVED");
  return next || "";
}

function currentPlanStage<T extends { stage: string; status: string; sortOrder: number; reviewer?: { displayName: string | null } | null }>(stages: T[]): T | null {
  const ordered = [...stages].sort((a, b) => a.sortOrder - b.sortOrder);
  return ordered.find((item) => ["PENDING_REVIEW", "CHANGES_REQUESTED"].includes(item.status))
    || ordered.find((item) => item.status === "WAITING")
    || [...ordered].reverse().find((item) => item.status === "APPROVED")
    || null;
}

function uniqueSorted(values: string[]) {
  return [...new Set(values.map(clean).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es"));
}

function reportOptions(rows: AdminAcademicReportRow[]) {
  const statuses = new Map<string, string>();
  const stages = new Map<string, string>();
  rows.forEach((row) => {
    if (row.statusCode) statuses.set(row.statusCode, row.statusLabel);
    if (row.stageCode) stages.set(row.stageCode, row.stageLabel);
  });
  return {
    periods: uniqueSorted(rows.map((row) => row.academicPeriod)),
    careers: uniqueSorted(rows.map((row) => row.career)),
    modalities: uniqueSorted(rows.map((row) => row.modality)),
    statuses: [...statuses.entries()].map(([code, label]) => ({ code, label })).sort((a, b) => a.label.localeCompare(b.label, "es")),
    stages: [...stages.entries()].map(([code, label]) => ({ code, label })).sort((a, b) => a.label.localeCompare(b.label, "es")),
  };
}

function reportSummary(rows: AdminAcademicReportRow[]) {
  const counts = new Map<string, { label: string; count: number }>();
  rows.forEach((row) => {
    const current = counts.get(row.statusCode) || { label: row.statusLabel, count: 0 };
    current.count += 1;
    counts.set(row.statusCode, current);
  });
  return {
    total: rows.length,
    byStatus: [...counts.entries()]
      .map(([code, item]) => ({ code, label: item.label, count: item.count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "es")),
  };
}

export async function loadAdminAcademicReport(filters: AdminAcademicReportFilters): Promise<AdminAcademicReportResult> {
  const projects = await database.project.findMany({
    where: { status: { not: "ARCHIVED" } },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      subjectCode: true,
      subjectName: true,
      professorName: true,
      academicPeriod: true,
      status: true,
      totalWeeks: true,
      updatedAt: true,
      owner: { select: { displayName: true } },
      weeks: { select: { status: true } },
      academicOffering: {
        select: {
          period: { select: { name: true } },
          modality: { select: { name: true } },
          program: {
            select: {
              name: true,
              academicLevel: { select: { name: true } },
              academicUnit: { select: { name: true } },
            },
          },
        },
      },
      teachingPlan: {
        select: {
          id: true,
          version: true,
          teacherReviewedAt: true,
          updatedAt: true,
          reviewWorkflow: {
            select: {
              status: true,
              completedAt: true,
              updatedAt: true,
              stages: {
                orderBy: { sortOrder: "asc" },
                select: {
                  stage: true,
                  sortOrder: true,
                  status: true,
                  approvedAt: true,
                  updatedAt: true,
                  reviewer: { select: { displayName: true } },
                  reviews: {
                    orderBy: { attempt: "desc" },
                    take: 1,
                    select: { decision: true, reviewedAt: true, updatedAt: true },
                  },
                },
              },
            },
          },
        },
      },
      guideReviews: {
        orderBy: { createdAt: "desc" },
        select: {
          stage: true,
          decision: true,
          reviewedAt: true,
          updatedAt: true,
          reviewedBy: { select: { displayName: true } },
        },
      },
    },
  });

  const now = new Date();
  const rows: AdminAcademicReportRow[] = projects.map((project) => {
    const career = project.academicOffering.program.name || "";
    const modality = project.academicOffering.modality.name || "";
    const academicPeriod = project.academicOffering.period.name || project.academicPeriod || "";
    const professorName = project.professorName || project.owner.displayName || "";
    const base = {
      projectId: project.id,
      subjectCode: project.subjectCode,
      subjectName: project.subjectName,
      professorName,
      academicLevel: project.academicOffering.program.academicLevel.name || "",
      academicUnit: project.academicOffering.program.academicUnit.name || "",
      career,
      modality,
      academicPeriod,
    };

    if (filters.document === "PLAN") {
      const plan = project.teachingPlan;
      const workflow = plan?.reviewWorkflow;
      const stages = (workflow?.stages || []).map((stage) => ({
        stage: String(stage.stage),
        status: String(stage.status),
        sortOrder: stage.sortOrder,
        approvedAt: stage.approvedAt,
        updatedAt: stage.updatedAt,
        reviewer: stage.reviewer,
        reviews: stage.reviews,
      }));
      const currentStage = currentPlanStage(stages);
      const status = deriveTeachingPlanReportStatus({
        hasPlan: Boolean(plan),
        teacherConfirmedAt: plan?.teacherReviewedAt,
        workflowStatus: workflow?.status ? String(workflow.status) : null,
      });
      const lastReviewAt = latestIso(stages.flatMap((stage) => stage.reviews.map((review) => review.reviewedAt)));
      const approvedAt = workflow?.status === "APPROVED" ? iso(workflow.completedAt) : null;
      const stateChangedAt = iso(workflow?.updatedAt || plan?.updatedAt || project.updatedAt) || project.updatedAt.toISOString();
      return {
        ...base,
        statusCode: status.code,
        statusLabel: status.label,
        stageCode: currentStage?.stage || "",
        stageLabel: currentStage?.stage ? (planStageLabels[currentStage.stage] || currentStage.stage) : "",
        reviewerName: currentStage?.reviewer?.displayName || "",
        lastReviewAt,
        approvedAt,
        updatedAt: project.updatedAt.toISOString(),
        stateChangedAt,
        daysInState: daysInAcademicReportState(stateChangedAt, now),
        planVersion: plan?.version ?? null,
        teacherConfirmedAt: iso(plan?.teacherReviewedAt),
      };
    }

    const latestByStage = new Map<string, (typeof project.guideReviews)[number]>();
    for (const review of project.guideReviews) {
      const stage = String(review.stage);
      if (!latestByStage.has(stage)) latestByStage.set(stage, review);
    }
    const latestStageDecisions: Record<string, string | undefined> = {};
    latestByStage.forEach((review, stage) => { latestStageDecisions[stage] = String(review.decision); });
    const status = deriveGuideReportStatus({ projectStatus: String(project.status), latestStageDecisions });
    const stageCode = nextGuideStage(latestStageDecisions);
    const currentReview = stageCode ? latestByStage.get(stageCode) : null;
    const lastReviewAt = latestIso(project.guideReviews.map((review) => review.reviewedAt));
    const allApproved = guideStageOrder.every((stage) => latestStageDecisions[stage] === "APPROVED");
    const approvedAt = allApproved
      ? latestIso(guideStageOrder.map((stage) => latestByStage.get(stage)?.reviewedAt))
      : null;
    const stateChangedAt = iso(currentReview?.updatedAt || (project.guideReviews[0]?.updatedAt) || project.updatedAt) || project.updatedAt.toISOString();
    const approvedWeeks = project.weeks.filter((week) => week.status === "APPROVED").length;
    const progressPercent = project.totalWeeks > 0 ? Math.round((approvedWeeks / project.totalWeeks) * 1000) / 10 : 0;
    const preparationStatus = project.status === "COMPLETED" ? "Finalizada" : project.status === "IN_PROGRESS" ? "En elaboración" : "Borrador";
    return {
      ...base,
      statusCode: status.code,
      statusLabel: status.label,
      stageCode,
      stageLabel: stageCode ? (guideStageLabels[stageCode] || stageCode) : "",
      reviewerName: currentReview?.reviewedBy?.displayName || "",
      lastReviewAt,
      approvedAt,
      updatedAt: project.updatedAt.toISOString(),
      stateChangedAt,
      daysInState: daysInAcademicReportState(stateChangedAt, now),
      approvedWeeks,
      totalWeeks: project.totalWeeks,
      progressPercent,
      preparationStatus,
    };
  });

  const options = reportOptions(rows);
  const filtered = rows.filter((row) => adminAcademicReportRowMatches(row, filters));
  return {
    document: filters.document,
    filters,
    generatedAt: now.toISOString(),
    summary: reportSummary(filtered),
    options,
    rows: filtered,
  };
}

function reportDateText(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("es-EC", {
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(date).reduce<Record<string, string>>((acc, part) => {
    if (part.type !== "literal") acc[part.type] = part.value;
    return acc;
  }, {});
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
}

function filterDescription(filters: AdminAcademicReportFilters) {
  return [
    ["Búsqueda", filters.search],
    ["Periodo", filters.period],
    ["Carrera", filters.career],
    ["Modalidad", filters.modality],
    ["Estado", filters.status],
    ["Etapa", filters.stage],
    ["Desde", filters.dateFrom],
    ["Hasta", filters.dateTo],
  ].filter(([, value]) => value).map(([label, value]) => ({ Filtro: label, Valor: value }));
}

function applySheetWidths(sheet: XLSX.WorkSheet, widths: number[]) {
  sheet["!cols"] = widths.map((wch) => ({ wch }));
}

export function buildAdminAcademicReportWorkbook(report: AdminAcademicReportResult) {
  const workbook = XLSX.utils.book_new();
  const title = report.document === "PLAN" ? "Plan Docente" : "Guía Didáctica";
  const summaryRows = [
    { Indicador: "Documento", Valor: title },
    { Indicador: "Fecha de generación", Valor: reportDateText(report.generatedAt) },
    { Indicador: "Total de registros", Valor: report.summary.total },
    ...report.summary.byStatus.map((item) => ({ Indicador: item.label, Valor: item.count })),
  ];
  const summarySheet = XLSX.utils.json_to_sheet(summaryRows);
  applySheetWidths(summarySheet, [34, 26]);
  XLSX.utils.book_append_sheet(workbook, summarySheet, "Resumen");

  const filters = filterDescription(report.filters);
  const filterSheet = XLSX.utils.json_to_sheet(filters.length ? filters : [{ Filtro: "Filtros aplicados", Valor: "Ninguno" }]);
  applySheetWidths(filterSheet, [24, 60]);
  XLSX.utils.book_append_sheet(workbook, filterSheet, "Filtros");

  const detailRows = report.rows.map((row) => report.document === "PLAN" ? {
    "Código": row.subjectCode,
    "Asignatura": row.subjectName,
    "Profesor": row.professorName,
    "Nivel académico": row.academicLevel,
    "Unidad académica": row.academicUnit,
    "Carrera": row.career,
    "Modalidad": row.modality,
    "Periodo": row.academicPeriod,
    "Versión Plan": row.planVersion ?? "",
    "Confirmación docente": reportDateText(row.teacherConfirmedAt),
    "Estado": row.statusLabel,
    "Etapa actual": row.stageLabel,
    "Responsable actual": row.reviewerName,
    "Última revisión": reportDateText(row.lastReviewAt),
    "Fecha de aprobación": reportDateText(row.approvedAt),
    "Días en estado": row.daysInState,
    "Última actualización": reportDateText(row.updatedAt),
  } : {
    "Código": row.subjectCode,
    "Asignatura": row.subjectName,
    "Profesor": row.professorName,
    "Nivel académico": row.academicLevel,
    "Unidad académica": row.academicUnit,
    "Carrera": row.career,
    "Modalidad": row.modality,
    "Periodo": row.academicPeriod,
    "Semanas aprobadas": row.approvedWeeks ?? 0,
    "Total semanas": row.totalWeeks ?? 0,
    "Progreso (%)": row.progressPercent ?? 0,
    "Estado de elaboración": row.preparationStatus || "",
    "Estado del proceso": row.statusLabel,
    "Etapa actual": row.stageLabel,
    "Responsable actual": row.reviewerName,
    "Última revisión": reportDateText(row.lastReviewAt),
    "Fecha de aprobación": reportDateText(row.approvedAt),
    "Días en estado": row.daysInState,
    "Última actualización": reportDateText(row.updatedAt),
  });
  const detailSheet = XLSX.utils.json_to_sheet(detailRows.length ? detailRows : [{ "Sin resultados": "No existen registros para los filtros seleccionados." }]);
  if (detailRows.length) detailSheet["!autofilter"] = { ref: detailSheet["!ref"] || "A1:A1" };
  applySheetWidths(detailSheet, report.document === "PLAN"
    ? [16, 34, 28, 20, 28, 30, 18, 20, 12, 22, 24, 22, 28, 22, 22, 16, 22]
    : [16, 34, 28, 20, 28, 30, 18, 20, 18, 14, 14, 22, 24, 22, 28, 22, 22, 16, 22]);
  XLSX.utils.book_append_sheet(workbook, detailSheet, "Detalle");

  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

export function adminAcademicReportFilename(document: AdminAcademicReportDocument, now = new Date()) {
  const date = now.toISOString().slice(0, 10);
  return document === "PLAN" ? `reporte-plan-docente-${date}.xlsx` : `reporte-guia-didactica-${date}.xlsx`;
}
