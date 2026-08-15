import { normalizeCatalogCode } from "./catalog-policy.js";

export type KnowledgePromptContext = {
  level: string;
  modality: string;
  weeks: number;
  subjectType?: string;
  subjectTypeLabel?: string;
};

export type KnowledgeScope = {
  academicLevels: string[];
  modalities: string[];
  durations: number[];
  subjectTypes: string[];
};

function normalizedScopeCode(value: string) {
  return normalizeCatalogCode(value).replace(/_/g, "-");
}

function exactScopeMatch(values: string[], value: string) {
  if (!values.length) return true;
  const expected = normalizedScopeCode(value);
  return values.some((entry) => normalizedScopeCode(entry) === expected);
}

function singleSubjectTypeScopeMatch(values: string[], value: string) {
  if (!values.length) return true;
  const expected = normalizedScopeCode(value);
  return values.some((entry) => {
    const candidate = normalizedScopeCode(entry);
    return candidate === expected
      || candidate.startsWith(`${expected}-`)
      || expected.startsWith(`${candidate}-`);
  });
}

function subjectTypeScopeMatch(values: string[], context: KnowledgePromptContext) {
  if (!values.length) return true;
  const candidates = [context.subjectType, context.subjectTypeLabel].filter((value): value is string => Boolean(value?.trim()));
  return candidates.some((candidate) => singleSubjectTypeScopeMatch(values, candidate));
}

function subjectTypeDescription(context: KnowledgePromptContext) {
  return context.subjectTypeLabel?.trim() || context.subjectType?.trim() || "GENERAL";
}

export function appliesToKnowledgeContext(item: KnowledgeScope, context: KnowledgePromptContext) {
  return exactScopeMatch(item.academicLevels, context.level)
    && exactScopeMatch(item.modalities, context.modality)
    && (!item.durations.length || item.durations.includes(context.weeks))
    && subjectTypeScopeMatch(item.subjectTypes, context);
}

export function knowledgeScopeMismatches(item: KnowledgeScope, context: KnowledgePromptContext) {
  const mismatches: string[] = [];
  if (!exactScopeMatch(item.academicLevels, context.level)) {
    mismatches.push(`nivel «${context.level}»`);
  }
  if (!exactScopeMatch(item.modalities, context.modality)) {
    mismatches.push(`modalidad «${context.modality}»`);
  }
  if (item.durations.length && !item.durations.includes(context.weeks)) {
    mismatches.push(`duración de ${context.weeks} semanas`);
  }
  if (!subjectTypeScopeMatch(item.subjectTypes, context)) {
    mismatches.push(`tipo de asignatura «${subjectTypeDescription(context)}»`);
  }
  return mismatches;
}
