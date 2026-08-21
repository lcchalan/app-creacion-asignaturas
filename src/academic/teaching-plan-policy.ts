import { z } from "zod";

export const contributionLevelSchema = z.enum(["INITIAL", "MIDDLE", "FINAL"]);

export const outcomeMappingSchema = z.object({
  learningOutcome: z.string().trim().min(1).max(2000),
  contribution: contributionLevelSchema,
  professionalCompetencies: z.array(z.string().trim().min(1).max(2000)).min(1).max(20),
  graduateProfileResults: z.array(z.string().trim().min(1).max(2000)).min(1).max(20),
  utplGenericCompetencies: z.array(z.string().trim().min(1).max(1000)).max(5),
});

export const outcomeMappingsSchema = z.array(outcomeMappingSchema).min(1).max(100);

export type ContributionCoverageSource = {
  learningOutcomes: string[];
  professionalProfileCompetencies: string[];
  graduateProfileResults: string[];
  utplGenericCompetencies: string[];
};

function normalizedCoverageValue(value: string) {
  return value.trim().toLocaleLowerCase("es");
}

function normalizedMappingList(values: string[]) {
  return values.map(normalizedCoverageValue).sort();
}

function contributionRelationKey(mapping: OutcomeMapping) {
  return JSON.stringify([
    normalizedCoverageValue(mapping.learningOutcome),
    normalizedMappingList(mapping.professionalCompetencies),
    normalizedMappingList(mapping.graduateProfileResults),
    normalizedMappingList(mapping.utplGenericCompetencies),
  ]);
}

export function assertContributionCoverage(
  mappings: OutcomeMapping[],
  source: ContributionCoverageSource,
) {
  const relationIndexes = new Map<string, number>();
  for (const [index, mapping] of mappings.entries()) {
    const key = contributionRelationKey(mapping);
    const previousIndex = relationIndexes.get(key);
    if (previousIndex !== undefined) {
      throw new Error(`La relación ${index + 1} repite la misma combinación de la relación ${previousIndex + 1}.`);
    }
    relationIndexes.set(key, index);
  }

  const rules: Array<{ label: string; expected: string[]; received: string[] }> = [
    {
      label: "resultados de aprendizaje",
      expected: source.learningOutcomes,
      received: mappings.map((item) => item.learningOutcome),
    },
    {
      label: "competencias profesionales",
      expected: source.professionalProfileCompetencies,
      received: mappings.flatMap((item) => item.professionalCompetencies),
    },
    {
      label: "resultados del perfil de egreso",
      expected: source.graduateProfileResults,
      received: mappings.flatMap((item) => item.graduateProfileResults),
    },
    {
      label: "competencias genéricas UTPL",
      expected: source.utplGenericCompetencies,
      received: mappings.flatMap((item) => item.utplGenericCompetencies),
    },
  ];
  for (const rule of rules) {
    const received = new Set(rule.received.map(normalizedCoverageValue));
    const missing = rule.expected.filter((item) => !received.has(normalizedCoverageValue(item)));
    if (missing.length) {
      throw new Error(`Debe relacionar todos los ${rule.label}; faltan: ${missing.join("; ")}.`);
    }
  }
}

export const teacherProfileSchema = z.object({
  thirdLevelDegrees: z.array(z.string().trim().min(2).max(500)).min(1).max(20),
  fourthLevelDegrees: z.array(z.string().trim().min(2).max(500)).max(20),
  faculty: z.string().trim().min(2).max(250),
  departmentId: z.string().uuid().optional(),
  department: z.string().trim().min(2).max(250),
  phone: z.string().trim().min(5).max(50),
  shortCv: z.string().trim().min(30).max(5000),
});

export function buildDidacticGuideReference(input: {
  subjectName: string;
  subjectCode?: string | null;
  career?: string | null;
  academicPeriod?: string | null;
}) {
  const year = String(input.academicPeriod || "").match(/\b(20\d{2})\b/)?.[1] || "s. f.";
  const code = String(input.subjectCode || "").trim();
  const career = String(input.career || "").trim();
  const parts = [
    `Universidad Técnica Particular de Loja. (${year}). Guía didáctica de ${String(input.subjectName || "").trim()}${code ? ` (${code})` : ""}.`,
    career ? `${career}.` : "",
  ].filter(Boolean);
  return parts.join(" ");
}

export function buildDidacticGuideImportance(input: { subjectName?: string | null }) {
  const subjectName = String(input.subjectName || "").trim();
  const subject = subjectName || "la asignatura";
  return `Esta guía didáctica orienta al estudiante en el estudio de ${subject}, organiza los contenidos, actividades y evaluaciones del periodo académico, y favorece el aprendizaje autónomo y el logro de los resultados de aprendizaje previstos.`;
}

export const planCategorySchema = z.enum(["CONCEPTUAL", "ACTIVE", "INTEGRATING"]);

export const teachingActivityComponentSchema = z.enum(["ACD", "APE", "AA"]);
export const evaluationInstrumentTypeSchema = z.enum(["QUESTIONNAIRE", "RUBRIC", "CHECKLIST", "RATING_SCALE", "OTHER"]);
export const questionnaireGradingModeSchema = z.enum(["LAST_ATTEMPT", "HIGHEST_GRADE"]);

export const teachingPlanActivityDetailSchema = z.object({
  component: teachingActivityComponentSchema,
  description: z.string().trim().min(3).max(3000),
  resource: z.string().trim().max(2000).default(""),
  hours: z.number().int().min(0).max(1000).default(0),
  evaluationCode: z.enum(["AC1", "AC2", "AC3", "AC4", "AC5"]).nullable().optional(),
});

export const teachingPlanInstrumentLevelSchema = z.object({
  label: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000),
  score: z.number().min(0).max(10),
});

export const teachingPlanInstrumentCriterionSchema = z.object({
  label: z.string().trim().min(2).max(1000),
  levels: z.array(teachingPlanInstrumentLevelSchema).min(2).max(8),
});

export const teachingPlanInstrumentConfigSchema = z.object({
  type: evaluationInstrumentTypeSchema,
  title: z.string().trim().min(2).max(300),
  maximumScore: z.literal(10),
  questionnaire: z.object({
    gradingMode: questionnaireGradingModeSchema,
    questionCount: z.number().int().min(1).max(200),
    timeMinutes: z.number().int().min(1).max(600),
  }).nullable(),
  criteria: z.array(teachingPlanInstrumentCriterionSchema).max(30),
});

export const teachingPlanWeekSchema = z.object({
  week: z.number().int().min(1).max(100),
  unitContents: z.array(z.string().trim().min(1).max(4000)).min(1).max(30),
  acdHours: z.number().int().min(0).max(1000),
  apeHours: z.number().int().min(0).max(1000),
  aaHours: z.number().int().min(0).max(1000),
  activities: z.array(z.string().trim().min(1).max(3000)).min(1).max(20),
  activityDetails: z.array(teachingPlanActivityDetailSchema).max(20).default([]),
  resources: z.array(z.string().trim().min(1).max(2000)).min(1).max(20),
  assessmentInstrument: z.string().trim().min(1).max(2000),
  grade: z.number().min(0).max(10),
});

export const teachingPlanAiWeekSchema = teachingPlanWeekSchema.extend({
  activityDetails: z.array(teachingPlanActivityDetailSchema).min(1).max(20),
});

export const teachingPlanSequenceSchema = z.object({
  learningOutcome: z.string().trim().min(1).max(2000),
  methodology: z.string().trim().min(3).max(4000),
  tac: z.array(z.string().trim().min(1).max(1000)).min(1).max(20),
  weeks: z.array(teachingPlanWeekSchema).min(1).max(100),
});

export const teachingPlanAiSequenceSchema = teachingPlanSequenceSchema.extend({
  weeks: z.array(teachingPlanAiWeekSchema).min(1).max(100),
});

export const teachingPlanEvaluationSchema = z.object({
  code: z.enum(["AC1", "AC2", "AC3", "AC4", "AC5"]),
  component: teachingActivityComponentSchema,
  week: z.number().int().min(1).max(100),
  activity: z.string().trim().min(3).max(3000),
  workStrategies: z.string().trim().min(3).max(5000),
  instrument: z.string().trim().min(2).max(2000),
  instrumentConfig: teachingPlanInstrumentConfigSchema.optional(),
  grade: z.number().min(0).max(10),
  weight: z.number().int().min(1).max(100),
});

export const teachingPlanAiEvaluationSchema = teachingPlanEvaluationSchema.extend({
  instrumentConfig: teachingPlanInstrumentConfigSchema,
});

export const teachingPlanAiContentSchema = z.object({
  presentation: z.string().trim().min(30).max(12_000),
  guideTitle: z.string().trim().min(3).max(300),
  guideDescription: z.string().trim().min(20).max(3000),
  sequences: z.array(teachingPlanAiSequenceSchema).min(1).max(100),
  evaluatedActivities: z.array(teachingPlanAiEvaluationSchema).length(5),
});

export const teachingPlanContentSchema = z.object({
  presentation: z.string().trim().min(30).max(12_000),
  guideTitle: z.string().trim().min(3).max(300),
  guideDescription: z.string().trim().min(20).max(3000),
  sequences: z.array(teachingPlanSequenceSchema).min(1).max(100),
  evaluatedActivities: z.array(teachingPlanEvaluationSchema).length(5),
  curricularAdaptations: z.string().trim().min(30).max(12_000).optional(),
});

export type OutcomeMapping = z.infer<typeof outcomeMappingSchema>;
export type TeacherProfile = z.infer<typeof teacherProfileSchema>;
export type PlanCategory = z.infer<typeof planCategorySchema>;
export type TeachingActivityComponent = z.infer<typeof teachingActivityComponentSchema>;
export type TeachingPlanInstrumentConfig = z.infer<typeof teachingPlanInstrumentConfigSchema>;
export type TeachingPlanActivityDetail = z.infer<typeof teachingPlanActivityDetailSchema>;
export type TeachingPlanContent = z.infer<typeof teachingPlanContentSchema>;

export class TeachingPlanConsistencyError extends Error {
  readonly statusCode = 422;
  readonly code = "TEACHING_PLAN_CONSISTENCY";

  constructor(message: string) {
    super(message);
    this.name = "TeachingPlanConsistencyError";
  }
}

export const evaluationRuleSchema = z.object({
  code: z.enum(["AC1", "AC2", "AC3", "AC4", "AC5"]),
  component: teachingActivityComponentSchema,
  week: z.number().int().min(1).max(100),
  grade: z.number().min(0).max(10),
  weight: z.number().int().min(1).max(100),
});

export const evaluationRulesSchema = z.array(evaluationRuleSchema).length(5).superRefine((rules, context) => {
  const expectedCodes = ["AC1", "AC2", "AC3", "AC4", "AC5"];
  const codes = rules.map((rule) => rule.code);
  if (new Set(codes).size !== expectedCodes.length || expectedCodes.some((code) => !codes.includes(code as typeof codes[number]))) {
    context.addIssue({ code: "custom", message: "La distribución debe contener exactamente AC1, AC2, AC3, AC4 y AC5." });
  }
  const weeks = rules.map((rule) => rule.week);
  if (new Set(weeks).size !== weeks.length) {
    context.addIssue({ code: "custom", message: "Cada actividad calificada debe estar asignada a una semana diferente." });
  }
  const totalGrade = rules.reduce((sum, rule) => sum + rule.grade, 0);
  if (Math.abs(totalGrade - 10) > 0.001) {
    context.addIssue({ code: "custom", message: `La calificación total debe sumar 10 puntos; actualmente suma ${totalGrade}.` });
  }
  const totalWeight = rules.reduce((sum, rule) => sum + rule.weight, 0);
  if (totalWeight !== 100) {
    context.addIssue({ code: "custom", message: `El peso total debe sumar 100%; actualmente suma ${totalWeight}%.` });
  }
});

export type EvaluationRule = z.infer<typeof evaluationRuleSchema>;

// Baseline institucional usado solo para bootstrap/compatibilidad y pruebas. En runtime, la fuente autoritativa es la versión persistida en PostgreSQL.
const evaluationRules: Record<PlanCategory, EvaluationRule[]> = {
  CONCEPTUAL: [
    { code: "AC1", component: "ACD", week: 2, grade: 1, weight: 10 },
    { code: "AC2", component: "AA", week: 4, grade: 1, weight: 10 },
    { code: "AC3", component: "ACD", week: 6, grade: 3, weight: 30 },
    { code: "AC4", component: "APE", week: 7, grade: 2, weight: 20 },
    { code: "AC5", component: "AA", week: 8, grade: 3, weight: 30 },
  ],
  ACTIVE: [
    { code: "AC1", component: "ACD", week: 2, grade: 0.5, weight: 5 },
    { code: "AC2", component: "APE", week: 4, grade: 2, weight: 20 },
    { code: "AC3", component: "ACD", week: 6, grade: 1.5, weight: 15 },
    { code: "AC4", component: "APE", week: 7, grade: 3, weight: 30 },
    { code: "AC5", component: "AA", week: 8, grade: 3, weight: 30 },
  ],
  INTEGRATING: [
    { code: "AC1", component: "ACD", week: 2, grade: 1, weight: 10 },
    { code: "AC2", component: "APE", week: 4, grade: 2, weight: 20 },
    { code: "AC3", component: "ACD", week: 6, grade: 1, weight: 10 },
    { code: "AC4", component: "APE", week: 7, grade: 4, weight: 40 },
    { code: "AC5", component: "AA", week: 8, grade: 2, weight: 20 },
  ],
};

export function evaluationRulesFor(category: PlanCategory): EvaluationRule[] {
  return evaluationRules[category].map((rule) => ({ ...rule }));
}


export function scaleInstrumentScoreToActivityGrade(instrumentScore: number, activityGrade: number) {
  if (!Number.isFinite(instrumentScore) || instrumentScore < 0 || instrumentScore > 10) {
    throw new Error("El puntaje del instrumento EVA debe estar entre 0 y 10 puntos.");
  }
  if (!Number.isFinite(activityGrade) || activityGrade < 0 || activityGrade > 10) {
    throw new Error("La calificación real de la actividad debe estar entre 0 y 10 puntos.");
  }
  return (instrumentScore * activityGrade) / 10;
}

function instrumentCriterionMaximum(criterion: z.infer<typeof teachingPlanInstrumentCriterionSchema>) {
  return Math.max(...criterion.levels.map((level) => level.score));
}

export function assertTeachingPlanInstrumentConfig(
  config: TeachingPlanInstrumentConfig,
  activityCode?: string,
) {
  const prefix = activityCode ? `${activityCode}: ` : "";
  if (config.maximumScore !== 10) {
    throw new TeachingPlanConsistencyError(`${prefix}todos los instrumentos deben configurarse sobre 10 puntos para EVA.`);
  }
  if (config.type === "QUESTIONNAIRE") {
    if (!config.questionnaire) {
      throw new TeachingPlanConsistencyError(`${prefix}el cuestionario debe indicar tipo de calificación, número de preguntas y tiempo en minutos.`);
    }
    if (config.criteria.length) {
      throw new TeachingPlanConsistencyError(`${prefix}un cuestionario no debe incluir criterios de rúbrica, cotejo o escala.`);
    }
    return;
  }
  if (config.type === "RUBRIC" || config.type === "CHECKLIST" || config.type === "RATING_SCALE") {
    if (!config.criteria.length) {
      throw new TeachingPlanConsistencyError(`${prefix}el instrumento debe contener criterios estructurados.`);
    }
    const maximum = config.criteria.reduce((sum, criterion) => sum + instrumentCriterionMaximum(criterion), 0);
    if (Math.abs(maximum - 10) > 0.001) {
      throw new TeachingPlanConsistencyError(`${prefix}la suma de los puntajes máximos de los criterios debe ser exactamente 10 puntos; actualmente suma ${maximum}.`);
    }
    if (config.type === "CHECKLIST" && config.criteria.some((criterion) => criterion.levels.length !== 2)) {
      throw new TeachingPlanConsistencyError(`${prefix}cada criterio de la lista de cotejo debe tener exactamente dos opciones.`);
    }
    if (config.type === "RATING_SCALE" && config.criteria.some((criterion) => criterion.levels.length < 3)) {
      throw new TeachingPlanConsistencyError(`${prefix}cada criterio de la escala de valoración debe tener al menos tres niveles.`);
    }
  }
}

export type TeachingPlanConsistencyInput = {
  totalWeeks: number;
  acdHours: number;
  apeHours: number;
  aaHours: number;
  learningOutcomes: string[];
  unitContents: string[];
  planCategory: PlanCategory;
  evaluationRules: EvaluationRule[];
};

type InstitutionalContentKind = "UNIT" | "CONTENT" | "SUBCONTENT";

function normalizedInstitutionalLiteral(value: string) {
  return value
    .normalize("NFKC")
    .trim()
    .replace(/\s+/gu, " ")
    .toLocaleLowerCase("es");
}

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

function institutionalContentIdentity(value: string) {
  let normalized = value.normalize("NFKC").trim();
  normalized = normalized.replace(/^["'“”«»]+|["'“”«»]+$/gu, "");
  normalized = normalized.replace(
    /^\s*(?:subcontenido|contenido|unidad)\s*(?:(?:n(?:ro|úm)?\.?\s*)?\d+(?:\.\d+)*\s*)?[:.\-–—]\s*/iu,
    "",
  );
  normalized = normalized.replace(
    /^\s*(?:subcontenido|contenido|unidad)\s+\d+(?:\.\d+)*\s+/iu,
    "",
  );
  normalized = normalized.replace(/^\s*\d+(?:\.\d+){0,3}\s*(?:[.)]|[:\-–—])\s*/u, "");
  return normalized
    .replace(/\s+/gu, " ")
    .replace(/[.;,:]+$/u, "")
    .trim()
    .toLocaleLowerCase("es");
}

type InstitutionalContentEntry = {
  value: string;
  literal: string;
  identity: string;
  kind: InstitutionalContentKind | null;
};

function uniqueContentEntries(entries: InstitutionalContentEntry[]) {
  const values = new Set<string>();
  return entries.filter((entry) => {
    if (values.has(entry.value)) return false;
    values.add(entry.value);
    return true;
  });
}

function selectInstitutionalContentCandidate(
  entries: InstitutionalContentEntry[],
  kind: InstitutionalContentKind | null,
) {
  const unique = uniqueContentEntries(entries);
  if (!kind) return unique;
  const sameKind = unique.filter((entry) => entry.kind === kind);
  return sameKind.length ? sameKind : unique;
}

export function canonicalizeTeachingPlanUnitContents(
  plan: TeachingPlanContent,
  allowedContents: string[],
): TeachingPlanContent {
  const entries = allowedContents.map((value) => ({
    value,
    literal: normalizedInstitutionalLiteral(value),
    identity: institutionalContentIdentity(value),
    kind: institutionalContentKind(value),
  }));
  const byLiteral = new Map<string, InstitutionalContentEntry[]>();
  const byIdentity = new Map<string, InstitutionalContentEntry[]>();
  for (const entry of entries) {
    byLiteral.set(entry.literal, [...(byLiteral.get(entry.literal) ?? []), entry]);
    if (entry.identity) {
      byIdentity.set(entry.identity, [...(byIdentity.get(entry.identity) ?? []), entry]);
    }
  }

  const resolve = (value: string, week: number) => {
    const literal = normalizedInstitutionalLiteral(value);
    const kind = institutionalContentKind(value);
    const literalCandidates = selectInstitutionalContentCandidate(byLiteral.get(literal) ?? [], kind);
    if (literalCandidates.length === 1) return literalCandidates[0]!.value;

    const identity = institutionalContentIdentity(value);
    const identityCandidates = selectInstitutionalContentCandidate(byIdentity.get(identity) ?? [], kind);
    if (identityCandidates.length === 1) return identityCandidates[0]!.value;
    if (identityCandidates.length > 1) {
      const options = identityCandidates.map((entry) => `«${entry.value}»`).join("; ");
      throw new TeachingPlanConsistencyError(
        `La semana ${week} contiene «${value}», que coincide con varios elementos de la oferta: ${options}. ` +
        "Use el texto institucional completo para evitar ambigüedades.",
      );
    }

    throw new TeachingPlanConsistencyError(
      `La IA propuso en la semana ${week} «${value}», pero ese texto no consta en las unidades, contenidos o subcontenidos de la oferta académica. ` +
      "No se guardó el plan. Regénere el plan o revise la información curricular de la oferta.",
    );
  };

  return {
    ...plan,
    sequences: plan.sequences.map((sequence) => ({
      ...sequence,
      weeks: sequence.weeks.map((week) => {
        const seen = new Set<string>();
        const unitContents = week.unitContents
          .map((value) => resolve(value, week.week))
          .filter((value) => {
            if (seen.has(value)) return false;
            seen.add(value);
            return true;
          });
        return { ...week, unitContents };
      }),
    })),
  };
}

export function assertTeachingPlanConsistency(
  plan: TeachingPlanContent,
  input: TeachingPlanConsistencyInput,
) {
  const normalized = normalizedInstitutionalLiteral;
  const expectedOutcomes = new Set(input.learningOutcomes.map(normalized));
  const sequenceOutcomes = plan.sequences.map((sequence) => normalized(sequence.learningOutcome));
  if (sequenceOutcomes.length !== expectedOutcomes.size ||
      sequenceOutcomes.some((outcome) => !expectedOutcomes.has(outcome)) ||
      new Set(sequenceOutcomes).size !== sequenceOutcomes.length) {
    throw new TeachingPlanConsistencyError("El plan debe incluir una secuencia única para cada resultado de aprendizaje institucional.");
  }

  const expectedContents = new Set(input.unitContents.map(normalized));
  const weeks = plan.sequences.flatMap((sequence) => sequence.weeks);
  const weekNumbers = weeks.map((week) => week.week);
  const expectedWeeks = Array.from({ length: input.totalWeeks }, (_, index) => index + 1);
  if (weekNumbers.length !== expectedWeeks.length ||
      new Set(weekNumbers).size !== weekNumbers.length ||
      expectedWeeks.some((week) => !weekNumbers.includes(week))) {
    throw new TeachingPlanConsistencyError("El plan debe distribuir una sola fila por cada semana lectiva, sin omisiones ni duplicados.");
  }
  for (const week of weeks) {
    if (week.unitContents.some((content) => !expectedContents.has(normalized(content)))) {
      throw new TeachingPlanConsistencyError(`La semana ${week.week} contiene una unidad o contenido que no consta literalmente en la oferta.`);
    }
  }

  const hours = weeks.reduce((totals, week) => ({
    acd: totals.acd + week.acdHours,
    ape: totals.ape + week.apeHours,
    aa: totals.aa + week.aaHours,
  }), { acd: 0, ape: 0, aa: 0 });
  if (hours.acd !== input.acdHours || hours.ape !== input.apeHours || hours.aa !== input.aaHours) {
    throw new TeachingPlanConsistencyError(
      `La distribución de horas no coincide con la oferta: ACD ${hours.acd}/${input.acdHours}, ` +
      `APE ${hours.ape}/${input.apeHours}, AA ${hours.aa}/${input.aaHours}.`,
    );
  }

  const expectedRules = input.evaluationRules;
  if (expectedRules.some((rule) => rule.week > input.totalWeeks)) {
    throw new TeachingPlanConsistencyError(`El tipo de asignatura requiere al menos ${Math.max(...expectedRules.map((rule) => rule.week))} semanas lectivas.`);
  }
  const actual = [...plan.evaluatedActivities].sort((a, b) => a.code.localeCompare(b.code));
  const expected = [...expectedRules].sort((a, b) => a.code.localeCompare(b.code));
  for (let index = 0; index < expected.length; index += 1) {
    const rule = expected[index];
    const activity = actual[index];
    if (!rule || !activity || rule.code !== activity.code || rule.component !== activity.component ||
        rule.week !== activity.week || rule.grade !== activity.grade || rule.weight !== activity.weight) {
      throw new TeachingPlanConsistencyError("Las actividades calificadas no respetan la distribución institucional del tipo de asignatura.");
    }
    if (activity.instrumentConfig) assertTeachingPlanInstrumentConfig(activity.instrumentConfig, activity.code);
  }

  const structuredDetails = weeks.flatMap((week) => week.activityDetails.map((detail) => ({ ...detail, week: week.week })));
  for (const week of weeks) {
    if (!week.activityDetails.some((detail) => Number(detail.hours || 0) > 0)) continue;
    const sums = { ACD: 0, APE: 0, AA: 0 };
    for (const detail of week.activityDetails) sums[detail.component] += Number(detail.hours || 0);
    if (sums.ACD !== week.acdHours || sums.APE !== week.apeHours || sums.AA !== week.aaHours) {
      throw new TeachingPlanConsistencyError(`La distribución de horas por actividad de la semana ${week.week} no coincide con las horas ACD, APE y AA definidas para esa semana.`);
    }
  }
  if (structuredDetails.length) {
    for (const activity of actual) {
      const linked = structuredDetails.filter((detail) => detail.evaluationCode === activity.code);
      if (linked.length !== 1 || linked[0]?.week !== activity.week || linked[0]?.component !== activity.component) {
        throw new TeachingPlanConsistencyError(
          `${activity.code} debe estar vinculada exactamente a una actividad de aprendizaje ${activity.component} de la semana ${activity.week}.`,
        );
      }
    }
  }
}

export type TeachingPlanReviewCheck = {
  code: "OUTCOMES" | "WEEKS" | "CONTENTS" | "HOURS" | "ACTIVITY_HOURS" | "EVALUATION" | "TOTALS" | "METHODOLOGY" | "INSTRUMENTS";
  label: string;
  ok: boolean;
  detail: string;
};

export function teachingPlanReviewChecks(
  plan: TeachingPlanContent,
  input: TeachingPlanConsistencyInput,
): TeachingPlanReviewCheck[] {
  const normalized = normalizedInstitutionalLiteral;
  const expectedOutcomes = new Set(input.learningOutcomes.map(normalized));
  const sequenceOutcomes = plan.sequences.map((sequence) => normalized(sequence.learningOutcome));
  const outcomesOk = sequenceOutcomes.length === expectedOutcomes.size &&
    new Set(sequenceOutcomes).size === sequenceOutcomes.length &&
    sequenceOutcomes.every((outcome) => expectedOutcomes.has(outcome));

  const weeks = plan.sequences.flatMap((sequence) => sequence.weeks);
  const weekNumbers = weeks.map((week) => week.week);
  const expectedWeeks = Array.from({ length: input.totalWeeks }, (_, index) => index + 1);
  const weeksOk = weekNumbers.length === expectedWeeks.length &&
    new Set(weekNumbers).size === weekNumbers.length &&
    expectedWeeks.every((week) => weekNumbers.includes(week));

  const expectedContents = new Set(input.unitContents.map(normalized));
  const unknownContents = weeks.flatMap((week) => week.unitContents
    .filter((content) => !expectedContents.has(normalized(content)))
    .map((content) => `Semana ${week.week}: ${content}`));
  const contentsOk = unknownContents.length === 0;

  const hours = weeks.reduce((totals, week) => ({
    acd: totals.acd + week.acdHours,
    ape: totals.ape + week.apeHours,
    aa: totals.aa + week.aaHours,
  }), { acd: 0, ape: 0, aa: 0 });
  const hoursOk = hours.acd === input.acdHours && hours.ape === input.apeHours && hours.aa === input.aaHours;
  const activityHoursConfigured = weeks.every((week) => week.activityDetails.length > 0 && week.activityDetails.every((detail) => Number(detail.hours || 0) >= 0));
  const activityHoursOk = activityHoursConfigured && weeks.every((week) => {
    const sums = { ACD: 0, APE: 0, AA: 0 };
    week.activityDetails.forEach((detail) => sums[detail.component] += Number(detail.hours || 0));
    return sums.ACD === week.acdHours && sums.APE === week.apeHours && sums.AA === week.aaHours;
  });

  const expectedRules = input.evaluationRules;
  const evaluationOk = plan.evaluatedActivities.length === expectedRules.length && expectedRules.every((rule) =>
    plan.evaluatedActivities.some((activity) =>
      activity.code === rule.code && activity.component === rule.component && activity.week === rule.week &&
      activity.grade === rule.grade && activity.weight === rule.weight));

  const totalGrade = plan.evaluatedActivities.reduce((sum, activity) => sum + activity.grade, 0);
  const totalWeight = plan.evaluatedActivities.reduce((sum, activity) => sum + activity.weight, 0);
  const totalsOk = Math.abs(totalGrade - 10) < 0.001 && totalWeight === 100;

  const methodologyOk = plan.sequences.every((sequence) =>
    sequence.methodology.trim().length >= 3 && sequence.tac.length >= 1 &&
    sequence.tac.every((item) => item.trim().length >= 1));

  let instrumentsOk = plan.evaluatedActivities.every((activity) => Boolean(activity.instrumentConfig));
  if (instrumentsOk) {
    try {
      plan.evaluatedActivities.forEach((activity) => assertTeachingPlanInstrumentConfig(activity.instrumentConfig!, activity.code));
    } catch {
      instrumentsOk = false;
    }
  }

  return [
    {
      code: "OUTCOMES",
      label: "Resultados de aprendizaje",
      ok: outcomesOk,
      detail: outcomesOk
        ? `${expectedOutcomes.size} de ${expectedOutcomes.size} resultados cubiertos, sin duplicados.`
        : "La secuencia no cubre exactamente todos los resultados institucionales.",
    },
    {
      code: "WEEKS",
      label: "Organización semanal",
      ok: weeksOk,
      detail: weeksOk
        ? `Semanas 1 a ${input.totalWeeks} completas, sin omisiones ni duplicados.`
        : `La planificación debe contener exactamente las semanas 1 a ${input.totalWeeks}.`,
    },
    {
      code: "CONTENTS",
      label: "Unidades y contenidos",
      ok: contentsOk,
      detail: contentsOk
        ? "Todos los contenidos corresponden literalmente a la oferta académica."
        : `Se encontraron contenidos ajenos a la oferta: ${unknownContents.join("; ")}.`,
    },
    {
      code: "HOURS",
      label: "Distribución de horas",
      ok: hoursOk,
      detail: `ACD ${hours.acd}/${input.acdHours} · APE ${hours.ape}/${input.apeHours} · AA ${hours.aa}/${input.aaHours}.`,
    },
    {
      code: "ACTIVITY_HOURS",
      label: "Horas por actividad",
      ok: activityHoursOk,
      detail: activityHoursOk
        ? "Las horas de cada actividad suman exactamente las horas ACD, APE y AA de su semana."
        : "Distribuya las horas de cada actividad hasta completar las horas ACD, APE y AA definidas para cada semana.",
    },
    {
      code: "EVALUATION",
      label: "Actividades calificadas",
      ok: evaluationOk,
      detail: evaluationOk
        ? "Las cinco actividades respetan semanas, componentes, puntajes y pesos institucionales."
        : "La evaluación no coincide con la distribución oficial del tipo de asignatura.",
    },
    {
      code: "TOTALS",
      label: "Totales de evaluación",
      ok: totalsOk,
      detail: `${totalGrade.toFixed(1)} puntos · ${totalWeight}% del total.`,
    },
    {
      code: "METHODOLOGY",
      label: "Metodologías y TAC",
      ok: methodologyOk,
      detail: methodologyOk
        ? "Cada resultado cuenta con metodología activa y al menos una TAC."
        : "Complete la metodología y las TAC de todos los resultados de aprendizaje.",
    },
    {
      code: "INSTRUMENTS",
      label: "Instrumentos para EVA",
      ok: instrumentsOk,
      detail: instrumentsOk
        ? "Las cinco actividades calificadas tienen un instrumento estructurado sobre 10 puntos para su futura configuración en EVA."
        : "Configure sobre 10 puntos el cuestionario, rúbrica, lista de cotejo o escala de valoración de cada actividad calificada.",
    },
  ];
}

export function planMatrixRows(plan: TeachingPlanContent) {
  return plan.sequences.flatMap((sequence) => sequence.weeks.map((week) => ({
    Semana: String(week.week),
    "Resultado de aprendizaje": sequence.learningOutcome,
    "Unidad/Contenido": week.unitContents.join("\n"),
    Metodología: sequence.methodology,
  }))).sort((left, right) => Number(left.Semana) - Number(right.Semana));
}
