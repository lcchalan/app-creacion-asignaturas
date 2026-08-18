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
