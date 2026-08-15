export const catalogKinds = [
  "levels", "modalities", "units", "programs",
  "subject-types", "periods", "courses", "departments", "offerings",
] as const;

export type CatalogKind = typeof catalogKinds[number];

export function isCatalogKind(value: string): value is CatalogKind {
  return catalogKinds.includes(value as CatalogKind);
}

export function normalizeCatalogCode(value: string) {
  return value.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").toUpperCase();
}

export function assertPeriodRange(startsAt?: Date | null, endsAt?: Date | null) {
  if (startsAt && endsAt && startsAt >= endsAt) {
    throw new Error("La fecha final del periodo debe ser posterior a la fecha inicial.");
  }
}


export function assertDateWindow(startsAt?: Date | null, endsAt?: Date | null, label = "El intervalo") {
  if (Boolean(startsAt) !== Boolean(endsAt)) {
    throw new Error(`${label}: registre tanto la fecha de inicio como la fecha de fin.`);
  }
  if (startsAt && endsAt && startsAt > endsAt) {
    throw new Error(`${label}: la fecha final no puede ser anterior a la fecha inicial.`);
  }
}

export function catalogRemovalMode(referenceCount: number): "DELETE" | "DEACTIVATE" {
  if (!Number.isInteger(referenceCount) || referenceCount < 0) {
    throw new Error("El número de referencias del catálogo no es válido.");
  }
  return referenceCount === 0 ? "DELETE" : "DEACTIVATE";
}

export type ProjectOfferingSyncMode = "NO_CHANGE" | "SYNC_DRAFT" | "REQUIRE_NEW_VERSION";

export function projectOfferingSyncMode(input: {
  snapshotChanged: boolean;
  hasTeachingPlan: boolean;
  hasGuideContent: boolean;
}): ProjectOfferingSyncMode {
  if (!input.snapshotChanged) return "NO_CHANGE";
  if (input.hasTeachingPlan || input.hasGuideContent) return "REQUIRE_NEW_VERSION";
  return "SYNC_DRAFT";
}
