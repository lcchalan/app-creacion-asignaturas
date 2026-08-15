export const knowledgeResourceKindLabels = {
  INSTITUTIONAL_DOCUMENT: "Documento institucional",
  PLAN_TEMPLATE: "Formato del Plan Docente",
  PLAN_PROMPT: "Prompt del Plan Docente",
  GUIDE_PROMPT: "Prompt de la Guía Didáctica",
} as const;

export type KnowledgeResourceKind = keyof typeof knowledgeResourceKindLabels;

function normalizedTitle(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("es")
    .replace(/\s+/g, " ")
    .trim();
}

export function suggestedResourceKind(title: string): KnowledgeResourceKind | null {
  const normalized = normalizedTitle(title);
  const mentionsPlan = /\bplan docente\b/.test(normalized);
  const mentionsGuide = /\bguia didactica\b/.test(normalized) || /\bprompt de la guia\b/.test(normalized);
  if (/\bformato\b/.test(normalized) && mentionsPlan) return "PLAN_TEMPLATE";
  if (/\bprompt\b/.test(normalized) && mentionsPlan) return "PLAN_PROMPT";
  if (/\bprompt\b/.test(normalized) && mentionsGuide) return "GUIDE_PROMPT";
  return null;
}

export function assertResourceKindMatchesTitle(title: string, resourceKind: KnowledgeResourceKind) {
  const suggested = suggestedResourceKind(title);
  if (!suggested || suggested === resourceKind) return;
  throw new Error(
    `El título «${title.trim()}» parece corresponder a «${knowledgeResourceKindLabels[suggested]}», ` +
    `pero está configurado como «${knowledgeResourceKindLabels[resourceKind]}». Corrija el tipo de recurso antes de guardar.`,
  );
}

export function canActivateKnowledgeStatus(status: string) {
  return status !== "ARCHIVED";
}

export function preferredKnowledgeVersion<T extends { priority: number; activatedAt?: Date | null; version: number }>(items: T[]): T | undefined {
  return [...items].sort((left, right) => {
    if (left.priority !== right.priority) return left.priority - right.priority;
    const leftActivated = left.activatedAt?.getTime() ?? 0;
    const rightActivated = right.activatedAt?.getTime() ?? 0;
    if (leftActivated !== rightActivated) return rightActivated - leftActivated;
    return right.version - left.version;
  })[0];
}

export function preferredSingularKnowledgeVersion<T extends { priority: number; activatedAt?: Date | null; version: number }>(items: T[]): T | undefined {
  return [...items].sort((left, right) => {
    const leftActivated = left.activatedAt?.getTime() ?? 0;
    const rightActivated = right.activatedAt?.getTime() ?? 0;
    if (leftActivated !== rightActivated) return rightActivated - leftActivated;
    if (left.version !== right.version) return right.version - left.version;
    return left.priority - right.priority;
  })[0];
}
