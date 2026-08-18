export const teachingPlanReviewStages = ["PEER", "QUALITY", "DIITEP", "DIRECTOR"] as const;
export type TeachingPlanReviewStage = typeof teachingPlanReviewStages[number];

export const teachingPlanReviewStageRole: Record<TeachingPlanReviewStage, string> = {
  PEER: "REVIEWER",
  QUALITY: "QUALITY",
  DIITEP: "DIITEP",
  DIRECTOR: "DIRECTOR",
};

export const teachingPlanReviewStageLabel: Record<TeachingPlanReviewStage, string> = {
  PEER: "Par académico",
  QUALITY: "Equipo de calidad",
  DIITEP: "DIITEP",
  DIRECTOR: "Dirección de carrera",
};

export type ReviewStageConfiguration = {
  stage: TeachingPlanReviewStage;
  enabled: boolean;
  sortOrder: number;
};

export function orderedEnabledTeachingPlanStages(items: ReviewStageConfiguration[]) {
  const seen = new Set<TeachingPlanReviewStage>();
  const orders = new Set<number>();
  const enabled = items
    .filter((item) => item.enabled)
    .sort((left, right) => left.sortOrder - right.sortOrder);

  for (const item of items) {
    if (seen.has(item.stage)) throw new Error(`La etapa ${item.stage} está configurada más de una vez.`);
    seen.add(item.stage);
    if (!Number.isInteger(item.sortOrder) || item.sortOrder < 1) {
      throw new Error("El orden de las etapas debe utilizar números enteros positivos.");
    }
    if (item.enabled && orders.has(item.sortOrder)) {
      throw new Error("Dos etapas activas no pueden tener el mismo orden.");
    }
    if (item.enabled) orders.add(item.sortOrder);
  }
  return enabled;
}

export function userCanActOnTeachingPlanStage(roleCodes: Iterable<string>, stage: TeachingPlanReviewStage) {
  const roles = new Set(roleCodes);
  return roles.has(teachingPlanReviewStageRole[stage]);
}

export function teachingPlanReviewWorkflowIsSuspended(processEnabled: boolean, workflowStatus: string | null | undefined) {
  return !processEnabled && ["IN_REVIEW", "CHANGES_REQUESTED"].includes(String(workflowStatus || ""));
}

export function nextTeachingPlanStage<T extends { sortOrder: number; status: string }>(
  stages: T[],
  currentSortOrder: number,
) {
  return [...stages]
    .filter((item) => item.sortOrder > currentSortOrder && item.status === "WAITING")
    .sort((left, right) => left.sortOrder - right.sortOrder)[0] ?? null;
}

export function previouslyApprovedTeachingPlanStages<T extends { sortOrder: number; status: string }>(
  stages: T[],
  currentSortOrder: number,
) {
  return [...stages]
    .filter((item) => item.sortOrder < currentSortOrder && item.status === "APPROVED")
    .sort((left, right) => left.sortOrder - right.sortOrder);
}

export const teachingPlanCorrectionResults = ["COMPLIES_PARTIALLY", "DOES_NOT_COMPLY"] as const;
export type TeachingPlanCorrectionResult = typeof teachingPlanCorrectionResults[number];

export function teachingPlanReviewItemNeedsCorrection(result: string) {
  return teachingPlanCorrectionResults.includes(result as TeachingPlanCorrectionResult);
}

export type TeachingPlanPreviewSection = "cover" | "a" | "b" | "c" | "d" | "e" | "f" | "g" | "h";

export function teachingPlanIndicatorPreviewSection(code: string): TeachingPlanPreviewSection {
  const normalized = String(code || "").trim().toUpperCase();
  if (/^A\d+/u.test(normalized)) return "a";
  if (/^B\d+/u.test(normalized)) return "b";
  if (/^C\d+/u.test(normalized)) return "c";
  if (/^D\d+/u.test(normalized)) return "d";
  if (/^E\d+/u.test(normalized)) return "e";
  if (/^F\d+/u.test(normalized)) return "f";
  if (/^G\d+/u.test(normalized)) return "g";
  if (normalized === "DI01") return "d";
  if (normalized === "DI02") return "e";
  if (normalized === "DIR01") return "c";
  if (normalized === "DIR02") return "h";
  return "cover";
}
