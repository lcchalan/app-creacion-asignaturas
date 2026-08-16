import { z } from "zod";

export const projectWorkflowModeSchema = z.enum(["NEW", "ADAPTATION_16_TO_8"]);
export const legacyDocumentTypeSchema = z.enum(["PLAN_16_WEEKS", "GUIDE_16_WEEKS"]);
export const adaptationTargetSchema = z.enum(["PLAN", "GUIDE"]);
export const adaptationActionSchema = z.enum([
  "KEEP",
  "GROUP",
  "MERGE",
  "SYNTHESIZE",
  "MOVE",
  "REFORMULATE",
  "DELETE",
  "SPLIT",
  "UPDATE",
]);
export const adaptationDecisionSchema = z.enum([
  "PENDING",
  "ACCEPTED",
  "EDITED",
  "REJECTED",
  "REGENERATE",
]);

export const adaptationWeekBreakdownItemSchema = z.object({
  week: z.number().int().min(1).max(100),
  content: z.string().trim().min(1).max(20_000),
});

export const adaptationChangeDraftSchema = z.object({
  action: adaptationActionSchema,
  sourceWeeks: z.array(z.number().int().min(1).max(100)).min(1).max(32),
  sourceContent: z.string().trim().min(1).max(20_000),
  sourceWeekBreakdown: z.array(adaptationWeekBreakdownItemSchema).max(32).optional().default([]),
  proposedWeeks: z.array(z.number().int().min(1).max(100)).max(16),
  proposedContent: z.string().trim().max(20_000),
  proposedWeekBreakdown: z.array(adaptationWeekBreakdownItemSchema).max(16).optional().default([]),
  rationale: z.string().trim().min(20).max(8_000),
  learningOutcomes: z.array(z.string().trim().min(1).max(2_000)).max(20),
  hoursImpact: z.string().trim().min(5).max(4_000),
  evaluationImpact: z.string().trim().min(5).max(4_000),
  institutionalBasis: z.array(z.string().trim().min(3).max(1_000)).min(1).max(20),
});

export const adaptationWeeklyStructureSchema = z.object({
  week: z.number().int().min(1).max(100),
  primaryLearningOutcome: z.string().trim().min(1).max(2_000),
  learningOutcomes: z.array(z.string().trim().min(1).max(2_000)).min(1).max(20),
  integrative: z.boolean(),
  contents: z.array(z.string().trim().min(1).max(4_000)).min(1).max(40),
  pedagogicalPurpose: z.string().trim().min(20).max(8_000),
  sourceWeeks: z.array(z.number().int().min(1).max(100)).min(1).max(32),
});

export const adaptationProposalOutputSchema = z.object({
  title: z.string().trim().min(5).max(300),
  overview: z.string().trim().min(50).max(12_000),
  sourceWeeks: z.number().int().min(1).max(100),
  targetWeeks: z.number().int().min(1).max(100),
  changes: z.array(adaptationChangeDraftSchema).min(1).max(150),
  weeklyStructure: z.array(adaptationWeeklyStructureSchema).min(1).max(100),
});

export type ProjectWorkflowMode = z.infer<typeof projectWorkflowModeSchema>;
export type LegacyDocumentType = z.infer<typeof legacyDocumentTypeSchema>;
export type AdaptationTarget = z.infer<typeof adaptationTargetSchema>;
export type AdaptationAction = z.infer<typeof adaptationActionSchema>;
export type AdaptationDecision = z.infer<typeof adaptationDecisionSchema>;
export type AdaptationWeekBreakdownItem = z.infer<typeof adaptationWeekBreakdownItemSchema>;
export type AdaptationChangeDraft = z.infer<typeof adaptationChangeDraftSchema>;
export type AdaptationWeeklyStructure = z.infer<typeof adaptationWeeklyStructureSchema>;
export type AdaptationProposalOutput = z.infer<typeof adaptationProposalOutputSchema>;

function normalized(value: string) {
  return value
    .normalize("NFKC")
    .trim()
    .replace(/\s+/gu, " ")
    .toLocaleLowerCase("es");
}

type InstitutionalContentKind = "UNIT" | "CONTENT" | "SUBCONTENT";

function institutionalContentKind(value: string): InstitutionalContentKind | null {
  const trimmed = value.normalize("NFKC").trim();
  const label = trimmed.match(/^\s*(subcontenido|contenido|unidad)\b/iu)?.[1]?.toLocaleLowerCase("es");
  if (label === "unidad") return "UNIT";
  if (label === "contenido") return "CONTENT";
  if (label === "subcontenido") return "SUBCONTENT";

  const hierarchy = trimmed.match(/^\s*(\d+(?:\.\d+){0,2})\s*(?:[.)]|[:\-–—])\s*/u)?.[1];
  if (!hierarchy) return null;
  const depth = hierarchy.split(".").length;
  if (depth === 1) return "UNIT";
  if (depth === 2) return "CONTENT";
  return "SUBCONTENT";
}

function institutionalReferencesFromText(value: string, allowedContents: string[]) {
  const segments = String(value || "")
    .split(/[\n;]+/u)
    .map((item) => normalized(item))
    .filter(Boolean);
  if (!segments.length) return [];
  return allowedContents.filter((item) => segments.includes(normalized(item)));
}

type InstitutionalHierarchyEntry = {
  value: string;
  normalizedValue: string;
  kind: InstitutionalContentKind | null;
  unit: string | null;
  content: string | null;
};

function institutionalHierarchyEntries(allowedContents: string[]): InstitutionalHierarchyEntry[] {
  let currentUnit: string | null = null;
  let currentContent: string | null = null;
  return allowedContents.map((value) => {
    const kind = institutionalContentKind(value);
    if (kind === "UNIT") {
      currentUnit = value;
      currentContent = null;
      return { value, normalizedValue: normalized(value), kind, unit: value, content: null };
    }
    if (kind === "CONTENT") {
      currentContent = value;
      return { value, normalizedValue: normalized(value), kind, unit: currentUnit, content: value };
    }
    if (kind === "SUBCONTENT") {
      return { value, normalizedValue: normalized(value), kind, unit: currentUnit, content: currentContent };
    }
    return { value, normalizedValue: normalized(value), kind, unit: currentUnit, content: currentContent };
  });
}

function weekByNumber(proposal: AdaptationProposalOutput, weekNumber: number) {
  return proposal.weeklyStructure.find((week) => week.week === weekNumber);
}

export class AdaptationProposalConsistencyError extends Error {
  readonly statusCode = 422;
  readonly code = "ADAPTATION_PROPOSAL_INVALID";

  constructor(message: string) {
    super(message);
    this.name = "AdaptationProposalConsistencyError";
  }
}

function consistencyError(message: string) {
  return new AdaptationProposalConsistencyError(message);
}

export function assertCurrentAdaptationWeeklyStructure(value: unknown) {
  const parsed = z.array(adaptationWeeklyStructureSchema).safeParse(value);
  if (!parsed.success) {
    throw consistencyError(
      "La propuesta fue generada con una estructura de adaptación anterior. Genere una nueva propuesta para aplicar la progresión por resultados de aprendizaje antes de aprobarla o crear el documento modular.",
    );
  }
  return parsed.data;
}

export function normalizeAdaptationProposalWeekReferences(
  proposal: AdaptationProposalOutput,
  targetWeeks: number,
) {
  const sourceToTargetWeeks = new Map<number, Set<number>>();
  for (const target of proposal.weeklyStructure) {
    if (target.week < 1 || target.week > targetWeeks) continue;
    for (const sourceWeek of target.sourceWeeks) {
      const mapped = sourceToTargetWeeks.get(sourceWeek) ?? new Set<number>();
      mapped.add(target.week);
      sourceToTargetWeeks.set(sourceWeek, mapped);
    }
  }

  let corrected = false;
  const changes = proposal.changes.map((change) => {
    if (change.action === "DELETE" && !change.proposedWeeks.length) return change;
    const hasInvalidDestination = !change.proposedWeeks.length ||
      change.proposedWeeks.some((week) => week < 1 || week > targetWeeks);
    if (!hasInvalidDestination) return change;

    const inferred = [...new Set<number>(change.sourceWeeks.flatMap((sourceWeek): number[] =>
      [...(sourceToTargetWeeks.get(sourceWeek) ?? [])],
    ))].sort((left: number, right: number) => left - right);
    if (!inferred.length) return change;
    corrected = true;
    return { ...change, proposedWeeks: inferred };
  });

  return {
    proposal: corrected ? { ...proposal, changes } : proposal,
    corrected,
  };
}

export function assertAdaptationProposalConsistency(
  proposal: AdaptationProposalOutput,
  input: {
    sourceWeeks: number;
    targetWeeks: number;
    learningOutcomes: string[];
    unitContents: string[];
    allowInstitutionalContentOmissions?: boolean;
  },
) {
  if (proposal.sourceWeeks !== input.sourceWeeks || proposal.targetWeeks !== input.targetWeeks) {
    throw consistencyError(`La propuesta debe transformar ${input.sourceWeeks} semanas de origen en ${input.targetWeeks} semanas de destino.`);
  }

  const expectedWeeks = Array.from({ length: input.targetWeeks }, (_, index) => index + 1);
  const receivedWeeks = proposal.weeklyStructure.map((item) => item.week);
  if (receivedWeeks.length !== expectedWeeks.length ||
      new Set(receivedWeeks).size !== receivedWeeks.length ||
      expectedWeeks.some((week) => !receivedWeeks.includes(week))) {
    throw consistencyError(`La propuesta debe contener una estructura única y completa de las semanas 1 a ${input.targetWeeks}.`);
  }

  const allowedOutcomes = new Set(input.learningOutcomes.map(normalized));
  const usedOutcomes = new Set<string>();
  const allowedContents = new Set(input.unitContents.map(normalized));
  const contentHierarchy = institutionalHierarchyEntries(input.unitContents);
  const contentHierarchyByValue = new Map(contentHierarchy.map((entry) => [entry.normalizedValue, entry]));
  const usedContents = new Set<string>();
  const orderedWeeks = [...proposal.weeklyStructure].sort((left, right) => left.week - right.week);

  for (const week of orderedWeeks) {
    if (week.sourceWeeks.some((sourceWeek) => sourceWeek < 1 || sourceWeek > input.sourceWeeks)) {
      throw consistencyError(`La semana ${week.week} referencia una semana de origen fuera del rango 1-${input.sourceWeeks}.`);
    }

    const primary = normalized(week.primaryLearningOutcome);
    if (!allowedOutcomes.has(primary)) {
      throw consistencyError(`La semana ${week.week} define un resultado de aprendizaje principal que no pertenece a la oferta vigente.`);
    }
    if (!week.learningOutcomes.some((outcome) => normalized(outcome) === primary)) {
      throw consistencyError(`La semana ${week.week} debe incluir su resultado de aprendizaje principal dentro de learningOutcomes.`);
    }

    for (const outcome of week.learningOutcomes) {
      const value = normalized(outcome);
      if (!allowedOutcomes.has(value)) {
        throw consistencyError(`La semana ${week.week} contiene un resultado de aprendizaje que no pertenece a la oferta vigente.`);
      }
      usedOutcomes.add(value);
    }

    const weekContents = new Set(week.contents.map(normalized));
    for (const content of week.contents) {
      const value = normalized(content);
      if (!allowedContents.has(value)) {
        throw consistencyError(`La semana ${week.week} contiene una unidad, tema o subtema que no pertenece a la oferta vigente.`);
      }
      const hierarchyEntry = contentHierarchyByValue.get(value);
      if (hierarchyEntry?.kind === "CONTENT" && hierarchyEntry.unit && !weekContents.has(normalized(hierarchyEntry.unit))) {
        throw consistencyError(
          `La semana ${week.week} incluye el tema «${content}» sin su unidad institucional «${hierarchyEntry.unit}». ` +
          "La propuesta debe conservar la jerarquía institucional para que el profesor pueda revisar el contenido sin ambigüedad.",
        );
      }
      if (hierarchyEntry?.kind === "SUBCONTENT") {
        if (hierarchyEntry.unit && !weekContents.has(normalized(hierarchyEntry.unit))) {
          throw consistencyError(`La semana ${week.week} incluye el subtema «${content}» sin su unidad institucional «${hierarchyEntry.unit}».`);
        }
        if (hierarchyEntry.content && !weekContents.has(normalized(hierarchyEntry.content))) {
          throw consistencyError(`La semana ${week.week} incluye el subtema «${content}» sin su tema institucional «${hierarchyEntry.content}».`);
        }
      }
      usedContents.add(value);
    }
  }

  const missingOutcomes = input.learningOutcomes.filter((item) => !usedOutcomes.has(normalized(item)));
  if (missingOutcomes.length) {
    throw consistencyError(`La propuesta deja resultados de aprendizaje vigentes sin cobertura: ${missingOutcomes.join("; ")}.`);
  }

  const missingContents = input.unitContents.filter((item) => !usedContents.has(normalized(item)));
  for (const missingContent of missingContents) {
    const kind = institutionalContentKind(missingContent);
    if (kind === "UNIT") {
      throw consistencyError(`La propuesta omite la unidad institucional «${missingContent}». Las unidades de la oferta deben permanecer identificables en la propuesta.`);
    }
    if (!input.allowInstitutionalContentOmissions) {
      throw consistencyError(`La propuesta deja un contenido institucional vigente sin ubicación: ${missingContent}.`);
    }

    const deletionCandidates = proposal.changes.filter((change) =>
      change.action === "DELETE" &&
      institutionalReferencesFromText(change.sourceContent, input.unitContents)
        .some((reference) => normalized(reference) === normalized(missingContent)),
    );
    if (!deletionCandidates.length) {
      throw consistencyError(`La propuesta omite «${missingContent}» sin presentarlo como una decisión explícita para revisión del profesor.`);
    }

    const validDeletion = deletionCandidates.some((change) => {
      const retainedReferences = institutionalReferencesFromText(change.proposedContent, input.unitContents)
        .filter((reference) =>
          institutionalContentKind(reference) !== "UNIT" &&
          normalized(reference) !== normalized(missingContent));
      if (!retainedReferences.length || !change.proposedWeeks.length || !change.learningOutcomes.length) return false;
      if (retainedReferences.some((reference) => !usedContents.has(normalized(reference)))) return false;
      return change.proposedWeeks.every((weekNumber) => {
        const destination = weekByNumber(proposal, weekNumber);
        if (!destination) return false;
        const destinationContents = new Set(destination.contents.map(normalized));
        return retainedReferences.some((reference) => destinationContents.has(normalized(reference)));
      });
    });
    if (!validDeletion) {
      throw consistencyError(
        `La omisión propuesta para «${missingContent}» debe identificar qué contenido institucional conservado mantiene la cobertura y en qué semana permanece.`,
      );
    }
  }

  for (const [index, change] of proposal.changes.entries()) {
    if (change.sourceWeeks.some((week) => week < 1 || week > input.sourceWeeks)) {
      throw consistencyError(`El cambio ${index + 1} referencia una semana de origen fuera del rango 1-${input.sourceWeeks}.`);
    }
    if ((change.sourceWeekBreakdown || []).some((item) => !change.sourceWeeks.includes(item.week))) {
      throw consistencyError(`El cambio ${index + 1} contiene un desglose de semanas de origen que no coincide con sourceWeeks.`);
    }
    if (change.proposedWeeks.some((week) => week < 1 || week > input.targetWeeks)) {
      throw consistencyError(`El cambio ${index + 1} referencia una semana de destino fuera del rango 1-${input.targetWeeks}.`);
    }
    if ((change.proposedWeekBreakdown || []).some((item) => !change.proposedWeeks.includes(item.week))) {
      throw consistencyError(`El cambio ${index + 1} contiene un desglose de semanas de destino que no coincide con proposedWeeks.`);
    }

    const sourceInstitutionalReferences = institutionalReferencesFromText(change.sourceContent, input.unitContents);
    if (change.action === "DELETE") {
      const removesCurrentInstitutionalContent = sourceInstitutionalReferences.length > 0;
      if (sourceInstitutionalReferences.some((item) => institutionalContentKind(item) === "UNIT")) {
        throw consistencyError(`El cambio ${index + 1} intenta omitir una unidad institucional. Las unidades de la oferta no pueden omitirse mediante una decisión individual.`);
      }
      if (removesCurrentInstitutionalContent) {
        if (sourceInstitutionalReferences.length !== 1) {
          throw consistencyError(`El cambio ${index + 1} debe presentar una sola omisión institucional para que el profesor pueda decidirla de forma independiente.`);
        }
        if (usedContents.has(normalized(sourceInstitutionalReferences[0]!))) {
          throw consistencyError(`El cambio ${index + 1} propone omitir «${sourceInstitutionalReferences[0]}», pero el mismo contenido todavía aparece en la estructura semanal.`);
        }
        const retainedReferences = institutionalReferencesFromText(change.proposedContent, input.unitContents)
          .filter((reference) =>
            institutionalContentKind(reference) !== "UNIT" &&
            !sourceInstitutionalReferences.some((source) => normalized(source) === normalized(reference)));
        if (!retainedReferences.length || !change.proposedWeeks.length) {
          throw consistencyError(`El cambio ${index + 1} debe identificar el contenido institucional conservado y la semana donde queda cubierta la omisión propuesta.`);
        }
        if (!change.learningOutcomes.length) {
          throw consistencyError(`El cambio ${index + 1} debe indicar qué resultado de aprendizaje mantiene su cobertura después de la omisión propuesta.`);
        }
      } else if (change.proposedWeeks.length || change.proposedContent) {
        throw consistencyError(`El cambio ${index + 1} retira material del documento anterior que no pertenece a la oferta vigente; en ese caso no debe asignar contenido ni semana de destino.`);
      }
    } else if (!change.proposedWeeks.length || !change.proposedContent) {
      throw consistencyError(`El cambio ${index + 1} debe indicar contenido y semana de destino.`);
    }

    if (change.learningOutcomes.some((item) => !allowedOutcomes.has(normalized(item)))) {
      throw consistencyError(`El cambio ${index + 1} relaciona un resultado de aprendizaje ajeno a la oferta vigente.`);
    }

    if (change.proposedWeeks.length && change.learningOutcomes.length) {
      const related = new Set(change.learningOutcomes.map(normalized));
      for (const destinationWeek of change.proposedWeeks) {
        const destination = weekByNumber(proposal, destinationWeek);
        if (!destination) continue;
        const destinationOutcomes = new Set(destination.learningOutcomes.map(normalized));
        if (![...related].some((outcome) => destinationOutcomes.has(outcome))) {
          throw consistencyError(`El cambio ${index + 1} se asigna a la semana ${destinationWeek}, pero sus resultados relacionados no coinciden con los resultados definidos para esa semana.`);
        }
      }
    }
  }
}

export function assertTeachingPlanRespectsApprovedAdaptation(
  plan: {
    sequences: Array<{
      learningOutcome: string;
      weeks: Array<{ week: number; unitContents: string[] }>;
    }>;
  },
  proposal: {
    weeklyStructure: unknown;
    changes: Array<{
      action: string;
      decision: string;
      sourceContent: string;
      proposedContent: string;
      teacherEditedContent?: string | null;
    }>;
  },
  institutionalContents: string[],
) {
  const approvedWeekly = assertCurrentAdaptationWeeklyStructure(proposal.weeklyStructure);

  const plannedWeeks = new Map<number, { learningOutcome: string; unitContents: string[] }>();
  for (const sequence of plan.sequences) {
    for (const week of sequence.weeks) {
      plannedWeeks.set(week.week, {
        learningOutcome: sequence.learningOutcome,
        unitContents: week.unitContents,
      });
    }
  }

  for (const approvedWeek of approvedWeekly) {
    const generatedWeek = plannedWeeks.get(approvedWeek.week);
    if (!generatedWeek) {
      throw consistencyError(`El Plan Docente generado no contiene la semana ${approvedWeek.week} aprobada en la propuesta de adaptación.`);
    }
    if (normalized(generatedWeek.learningOutcome) !== normalized(approvedWeek.primaryLearningOutcome)) {
      throw consistencyError(
        `La semana ${approvedWeek.week} del Plan Docente fue asociada a un resultado distinto del aprobado en la propuesta de adaptación.`,
      );
    }
    const approvedContentSet = new Set(approvedWeek.contents.map(normalized));
    const generatedContentSet = new Set(generatedWeek.unitContents.map(normalized));
    const missingContents = approvedWeek.contents.filter((content) => !generatedContentSet.has(normalized(content)));
    const unexpectedContents = generatedWeek.unitContents.filter((content) => !approvedContentSet.has(normalized(content)));
    if (missingContents.length || unexpectedContents.length) {
      const details = [
        missingContents.length ? `faltan: ${missingContents.join("; ")}` : "",
        unexpectedContents.length ? `no estaban aprobados para esta semana: ${unexpectedContents.join("; ")}` : "",
      ].filter(Boolean).join(" | ");
      throw consistencyError(
        `La semana ${approvedWeek.week} del Plan Docente no conserva exactamente los contenidos aprobados en la propuesta de adaptación (${details}).`,
      );
    }
  }

  const approvedWeeklyContents = new Set(
    approvedWeekly.flatMap((week) => week.contents.map(normalized)),
  );
  const generatedContents = new Set(
    plan.sequences.flatMap((sequence) => sequence.weeks.flatMap((week) => week.unitContents.map(normalized))),
  );

  for (const change of proposal.changes) {
    if (change.action !== "DELETE" || !["ACCEPTED", "EDITED"].includes(change.decision)) continue;
    const deletedReferences = institutionalReferencesFromText(change.sourceContent, institutionalContents)
      .filter((reference) => !approvedWeeklyContents.has(normalized(reference)));
    for (const deleted of deletedReferences) {
      if (generatedContents.has(normalized(deleted))) {
        throw consistencyError(
          `El Plan Docente reincorporó «${deleted}», aunque su omisión fue aprobada por el profesor.`,
        );
      }
    }
  }
}

export function adaptationProposalCanBeApproved(
  changes: Array<{
    decision: AdaptationDecision;
    teacherEditedContent?: string | null;
    teacherComment?: string | null;
  }>,
) {
  if (!changes.length) return false;
  return changes.every((change) =>
    change.decision === "ACCEPTED" ||
    (change.decision === "EDITED" &&
      Boolean(change.teacherEditedContent?.trim()) &&
      Boolean(change.teacherComment?.trim() && change.teacherComment.trim().length >= 10)),
  );
}

export function resolvedAdaptationContent(change: {
  action?: AdaptationAction;
  decision: AdaptationDecision;
  sourceContent: string;
  proposedContent: string;
  teacherEditedContent?: string | null;
}) {
  if (change.action === "DELETE") return "";
  if (change.decision === "EDITED") return change.teacherEditedContent?.trim() || "";
  if (change.decision === "ACCEPTED") return change.proposedContent;
  return "";
}
