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

export const adaptationChangeDraftSchema = z.object({
  action: adaptationActionSchema,
  sourceWeeks: z.array(z.number().int().min(1).max(100)).min(1).max(32),
  sourceContent: z.string().trim().min(1).max(20_000),
  proposedWeeks: z.array(z.number().int().min(1).max(100)).max(16),
  proposedContent: z.string().trim().max(20_000),
  rationale: z.string().trim().min(20).max(8_000),
  learningOutcomes: z.array(z.string().trim().min(1).max(2_000)).max(20),
  hoursImpact: z.string().trim().min(5).max(4_000),
  evaluationImpact: z.string().trim().min(5).max(4_000),
  institutionalBasis: z.array(z.string().trim().min(3).max(1_000)).min(1).max(20),
});

export const adaptationWeeklyStructureSchema = z.object({
  week: z.number().int().min(1).max(100),
  learningOutcomes: z.array(z.string().trim().min(1).max(2_000)).min(1).max(20),
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
export type AdaptationChangeDraft = z.infer<typeof adaptationChangeDraftSchema>;
export type AdaptationWeeklyStructure = z.infer<typeof adaptationWeeklyStructureSchema>;
export type AdaptationProposalOutput = z.infer<typeof adaptationProposalOutputSchema>;

function normalized(value: string) {
  return value.trim().toLocaleLowerCase("es");
}

export function assertAdaptationProposalConsistency(
  proposal: AdaptationProposalOutput,
  input: {
    sourceWeeks: number;
    targetWeeks: number;
    learningOutcomes: string[];
    unitContents: string[];
  },
) {
  if (proposal.sourceWeeks !== input.sourceWeeks || proposal.targetWeeks !== input.targetWeeks) {
    throw new Error(`La propuesta debe transformar ${input.sourceWeeks} semanas de origen en ${input.targetWeeks} semanas de destino.`);
  }

  const expectedWeeks = Array.from({ length: input.targetWeeks }, (_, index) => index + 1);
  const receivedWeeks = proposal.weeklyStructure.map((item) => item.week);
  if (receivedWeeks.length !== expectedWeeks.length ||
      new Set(receivedWeeks).size !== receivedWeeks.length ||
      expectedWeeks.some((week) => !receivedWeeks.includes(week))) {
    throw new Error(`La propuesta debe contener una estructura única y completa de las semanas 1 a ${input.targetWeeks}.`);
  }

  const allowedOutcomes = new Set(input.learningOutcomes.map(normalized));
  const usedOutcomes = new Set<string>();
  const allowedContents = new Set(input.unitContents.map(normalized));
  const usedContents = new Set<string>();

  for (const week of proposal.weeklyStructure) {
    if (week.sourceWeeks.some((sourceWeek) => sourceWeek < 1 || sourceWeek > input.sourceWeeks)) {
      throw new Error(`La semana ${week.week} referencia una semana de origen fuera del rango 1-${input.sourceWeeks}.`);
    }
    for (const outcome of week.learningOutcomes) {
      const value = normalized(outcome);
      if (!allowedOutcomes.has(value)) {
        throw new Error(`La semana ${week.week} contiene un resultado de aprendizaje que no pertenece a la oferta vigente.`);
      }
      usedOutcomes.add(value);
    }
    for (const content of week.contents) {
      const value = normalized(content);
      if (!allowedContents.has(value)) {
        throw new Error(`La semana ${week.week} contiene una unidad o contenido que no pertenece a la oferta vigente.`);
      }
      usedContents.add(value);
    }
  }

  const missingOutcomes = input.learningOutcomes.filter((item) => !usedOutcomes.has(normalized(item)));
  if (missingOutcomes.length) {
    throw new Error(`La propuesta deja resultados de aprendizaje vigentes sin cobertura: ${missingOutcomes.join("; ")}.`);
  }
  const missingContents = input.unitContents.filter((item) => !usedContents.has(normalized(item)));
  if (missingContents.length) {
    throw new Error(`La propuesta deja contenidos institucionales vigentes sin ubicación: ${missingContents.join("; ")}.`);
  }

  for (const [index, change] of proposal.changes.entries()) {
    if (change.sourceWeeks.some((week) => week < 1 || week > input.sourceWeeks)) {
      throw new Error(`El cambio ${index + 1} referencia una semana de origen fuera del rango 1-${input.sourceWeeks}.`);
    }
    if (change.proposedWeeks.some((week) => week < 1 || week > input.targetWeeks)) {
      throw new Error(`El cambio ${index + 1} referencia una semana de destino fuera del rango 1-${input.targetWeeks}.`);
    }
    if (change.action === "DELETE") {
      if (change.proposedWeeks.length || change.proposedContent) {
        throw new Error(`El cambio ${index + 1} marcado como eliminación no debe asignar contenido ni semana de destino.`);
      }
    } else if (!change.proposedWeeks.length || !change.proposedContent) {
      throw new Error(`El cambio ${index + 1} debe indicar contenido y semana de destino.`);
    }
    if (change.learningOutcomes.some((item) => !allowedOutcomes.has(normalized(item)))) {
      throw new Error(`El cambio ${index + 1} relaciona un resultado de aprendizaje ajeno a la oferta vigente.`);
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
  decision: AdaptationDecision;
  sourceContent: string;
  proposedContent: string;
  teacherEditedContent?: string | null;
}) {
  if (change.decision === "EDITED") return change.teacherEditedContent?.trim() || "";
  if (change.decision === "ACCEPTED") return change.proposedContent;
  return "";
}
