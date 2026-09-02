import { z } from "zod";
import {
  evaluationRulesSchema,
  outcomeMappingsSchema,
  planCategorySchema,
  teacherProfileSchema,
  teachingPlanContentSchema,
  type PlanCategory,
  type TeachingPlanContent,
} from "./academic/teaching-plan-policy.js";
import {
  questionBankStatusSchema,
  questionOptionSchema,
  questionSourceSchema,
  questionTypeConfigurationSchema,
  questionTypeSchema,
  requiredQuestionBankSize,
} from "./academic/question-bank.js";
import type { PlanTemplateProfile } from "./academic/plan-template-profile.js";
import type { TeachingPlanWordInput } from "./teaching-plan-word.js";

export const CANONICAL_TEACHING_PLAN_SCHEMA_VERSION = "1.2.0" as const;
export const CANONICAL_TEACHING_PLAN_SCHEMA_PATH = "/schemas/teaching-plan-canonical-v1.schema.json" as const;

const isoDateTimeSchema = z.string().datetime({ offset: true });
const nullableIsoDateTimeSchema = isoDateTimeSchema.nullable();

const canonicalTemplateSnapshotSchema = z.strictObject({
  id: z.string().uuid(),
  title: z.string().min(1),
  version: z.number().int().positive(),
  checksum: z.string().nullable(),
  profile: z.enum(["CURRENT_MODULAR", "LEGACY_MODULAR", "DYNAMIC_MODULAR"]),
});

const canonicalBibliographyEntrySchema = z.strictObject({
  id: z.string().uuid(),
  type: z.enum(["BASIC", "COMPLEMENTARY", "REA"]),
  citation: z.string(),
  title: z.string(),
  url: z.string(),
  notes: z.string(),
  sortOrder: z.number().int().nonnegative(),
});

const canonicalQuestionSchema = z.strictObject({
  id: z.string().uuid(),
  sortOrder: z.number().int().positive(),
  type: questionTypeSchema,
  topic: z.string().min(1),
  prompt: z.string().min(1),
  options: z.array(questionOptionSchema),
  answerKey: z.array(z.string().min(1)),
  feedbackCorrect: z.string().min(1),
  feedbackIncorrect: z.string().min(1),
  source: questionSourceSchema,
  version: z.number().int().positive(),
});

const canonicalQuestionBankSchema = z.strictObject({
  id: z.string().uuid(),
  evaluatedCode: z.enum(["AC1", "AC2", "AC3", "AC4", "AC5"]),
  minimumRequired: z.number().int().positive(),
  topicScope: z.array(z.string().min(1)).min(1),
  typeConfiguration: questionTypeConfigurationSchema,
  generationInstructions: z.string(),
  status: questionBankStatusSchema,
  version: z.number().int().positive(),
  approvedAt: nullableIsoDateTimeSchema,
  questions: z.array(canonicalQuestionSchema),
});

const canonicalTeachingPlanBaseSchema = z.strictObject({
  $schema: z.literal(CANONICAL_TEACHING_PLAN_SCHEMA_PATH),
  schemaVersion: z.literal(CANONICAL_TEACHING_PLAN_SCHEMA_VERSION),
  documentType: z.literal("teaching-plan"),
  documentId: z.string().uuid(),
  projectId: z.string().uuid(),
  language: z.literal("es"),
  status: z.enum(["draft", "in_review", "changes_requested", "approved", "archived"]),
  planVersion: z.number().int().positive(),
  format: z.strictObject({
    snapshot: canonicalTemplateSnapshotSchema,
    active: canonicalTemplateSnapshotSchema.nullable(),
    outdated: z.boolean(),
  }),
  metadata: z.strictObject({
    projectName: z.string().min(1),
    academicLevel: z.string().min(1),
    faculty: z.string().min(1),
    career: z.string().min(1),
    professorName: z.string().min(1),
    professorEmail: z.string().email(),
    subject: z.strictObject({
      code: z.string(),
      sisCode: z.string().nullable(),
      metacourseUrl: z.string().nullable(),
      name: z.string().min(1),
      typeCode: z.string().min(1),
      typeName: z.string().min(1),
      category: planCategorySchema,
    }),
    modality: z.string().min(1),
    academicPeriod: z.string().min(1),
    totalWeeks: z.number().int().positive(),
  }),
  academicOffer: z.strictObject({
    offeringCode: z.string().min(1),
    credits: z.number().nullable(),
    acdHours: z.number().int().nonnegative(),
    apeHours: z.number().int().nonnegative(),
    aaHours: z.number().int().nonnegative(),
    totalHours: z.number().int().nonnegative(),
    semester: z.string().nullable(),
    prerequisites: z.array(z.string()),
    learningOutcomes: z.array(z.string().min(1)).min(1),
    unitContents: z.array(z.string().min(1)).min(1),
    period: z.strictObject({
      startsAt: nullableIsoDateTimeSchema,
      endsAt: nullableIsoDateTimeSchema,
      bimestralEvaluationStartAt: nullableIsoDateTimeSchema,
      bimestralEvaluationEndAt: nullableIsoDateTimeSchema,
      recoveryEvaluationStartAt: nullableIsoDateTimeSchema,
      recoveryEvaluationEndAt: nullableIsoDateTimeSchema,
    }),
  }),
  contributionMappings: outcomeMappingsSchema,
  teacher: z.strictObject({
    name: z.string().min(1),
    email: z.string().email(),
    profile: teacherProfileSchema,
  }),
  bibliography: z.strictObject({
    guideReference: z.string(),
    guideReferenceImportance: z.string(),
    basicText: z.string(),
    complementaryText: z.string(),
    reaText: z.string(),
    entries: z.array(canonicalBibliographyEntrySchema),
  }),
  content: teachingPlanContentSchema,
  evaluationPolicy: z.strictObject({
    id: z.string().uuid(),
    category: planCategorySchema,
    version: z.number().int().positive(),
    title: z.string().min(1),
    rules: evaluationRulesSchema,
  }),
  questionBanks: z.array(canonicalQuestionBankSchema),
  traceability: z.strictObject({
    templateSnapshotId: z.string().uuid(),
    promptSnapshot: z.strictObject({
      id: z.string().uuid(),
      title: z.string().min(1),
      version: z.number().int().positive(),
      checksum: z.string().nullable(),
    }).nullable(),
    documentSnapshotIds: z.array(z.string().uuid()),
    specificationSnapshotIds: z.array(z.string().uuid()),
    generatedAt: isoDateTimeSchema,
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
    teacherReviewedAt: nullableIsoDateTimeSchema,
    methodologyApprovedAt: nullableIsoDateTimeSchema,
    planningApprovedAt: nullableIsoDateTimeSchema,
  }),
});

export const canonicalTeachingPlanSchema = canonicalTeachingPlanBaseSchema.superRefine((document, context) => {
  const weeks = document.content.sequences.flatMap((sequence) => sequence.weeks);
  if (weeks.length !== document.metadata.totalWeeks) {
    context.addIssue({ code: "custom", path: ["content", "sequences"], message: "La planificación canónica debe contener exactamente el total de semanas del proyecto." });
  }
  const weekNumbers = weeks.map((week) => week.week);
  if (new Set(weekNumbers).size !== document.metadata.totalWeeks || Array.from({ length: document.metadata.totalWeeks }, (_, index) => index + 1).some((week) => !weekNumbers.includes(week))) {
    context.addIssue({ code: "custom", path: ["content", "sequences"], message: "Las semanas del Plan Docente canónico deben cubrir la secuencia completa sin duplicados." });
  }
  if (document.evaluationPolicy.category !== document.metadata.subject.category) {
    context.addIssue({ code: "custom", path: ["evaluationPolicy", "category"], message: "La política de evaluación debe corresponder a la categoría de la asignatura." });
  }
  for (const [bankIndex, bank] of document.questionBanks.entries()) {
    const evaluated = document.content.evaluatedActivities.find((activity) => activity.code === bank.evaluatedCode);
    if (!evaluated?.instrumentConfig || evaluated.instrumentConfig.type !== "QUESTIONNAIRE" || !evaluated.instrumentConfig.questionnaire) {
      context.addIssue({ code: "custom", path: ["questionBanks", bankIndex], message: `El banco ${bank.evaluatedCode} debe corresponder a una actividad cuyo instrumento sea Cuestionario.` });
      continue;
    }
    const week = weeks.find((item) => item.week === evaluated.week);
    if (!week || (bank.status !== "NEEDS_REVIEW" && bank.topicScope.some((topic) => !week.unitContents.includes(topic)))) {
      context.addIssue({ code: "custom", path: ["questionBanks", bankIndex, "topicScope"], message: `El banco ${bank.evaluatedCode} contiene temas fuera de la semana evaluada.` });
    }
    const required = requiredQuestionBankSize(bank.minimumRequired, evaluated.instrumentConfig.questionnaire.questionCount);
    if (bank.status === "APPROVED" && bank.questions.length < required) {
      context.addIssue({ code: "custom", path: ["questionBanks", bankIndex, "questions"], message: `El banco aprobado ${bank.evaluatedCode} debe contener al menos ${required} preguntas.` });
    }
  }
});

export const canonicalTeachingPlanDocumentSchema = canonicalTeachingPlanSchema;
export type CanonicalTeachingPlan = z.infer<typeof canonicalTeachingPlanSchema>;

export type CanonicalTeachingPlanSource = {
  project: {
    id: string;
    name: string;
    level: string;
    faculty: string;
    career: string;
    professorName: string;
    subjectCode: string;
    subjectName: string;
    subjectType: string;
    modality: string;
    academicPeriod: string;
    totalWeeks: number;
    status: string;
    guideReference: string;
    guideReferenceImportance: string;
    basicBib: string;
    complementaryBib: string;
    reaBib: string | null;
  };
  owner: { displayName: string; email: string };
  offering: {
    code: string;
    sisCode: string | null;
    metacourseUrl: string | null;
    subjectTypeName: string;
    category: PlanCategory;
    credits: number | null;
    acdHours: number;
    apeHours: number;
    aaHours: number;
    semester: string | null;
    prerequisites: string[];
    learningOutcomes: string[];
    unitContents: string[];
    period: {
      startsAt: Date | null;
      endsAt: Date | null;
      bimestralEvaluationStartAt: Date | null;
      bimestralEvaluationEndAt: Date | null;
      recoveryEvaluationStartAt: Date | null;
      recoveryEvaluationEndAt: Date | null;
    };
  };
  mappings: z.infer<typeof outcomeMappingsSchema>;
  teacherProfile: z.infer<typeof teacherProfileSchema>;
  bibliographyEntries: Array<{
    id: string;
    type: "BASIC" | "COMPLEMENTARY" | "REA";
    citation: string;
    title: string;
    url: string;
    notes: string;
    sortOrder: number;
  }>;
  teachingPlan: {
    id: string;
    status: string;
    content: TeachingPlanContent;
    version: number;
    templateSnapshotId: string;
    promptSnapshotId: string | null;
    documentSnapshotIds: string[];
    specificationSnapshotIds: string[];
    generatedAt: Date;
    createdAt: Date;
    updatedAt: Date;
    teacherReviewedAt: Date | null;
    methodologyApprovedAt: Date | null;
    planningApprovedAt: Date | null;
    reviewWorkflowStatus: string | null;
  };
  questionBanks: Array<{
    id: string;
    evaluatedCode: "AC1" | "AC2" | "AC3" | "AC4" | "AC5";
    minimumRequired: number;
    topicScope: string[];
    typeConfiguration: z.infer<typeof questionTypeConfigurationSchema>;
    generationInstructions: string;
    status: z.infer<typeof questionBankStatusSchema>;
    version: number;
    approvedAt: Date | null;
    questions: Array<{
      id: string; sortOrder: number; type: z.infer<typeof questionTypeSchema>; topic: string; prompt: string;
      options: z.infer<typeof questionOptionSchema>[]; answerKey: string[]; feedbackCorrect: string; feedbackIncorrect: string;
      source: z.infer<typeof questionSourceSchema>; version: number;
    }>;
  }>;
  templateSnapshot: {
    id: string;
    title: string;
    version: number;
    checksum: string | null;
    profile: PlanTemplateProfile["profile"];
  };
  activeTemplate: {
    id: string;
    title: string;
    version: number;
    checksum: string | null;
    profile: PlanTemplateProfile["profile"];
  } | null;
  promptSnapshot: { id: string; title: string; version: number; checksum: string | null } | null;
  evaluationPolicy: {
    id: string;
    category: PlanCategory;
    version: number;
    title: string;
    rules: z.infer<typeof evaluationRulesSchema>;
  };
};

function canonicalStatus(source: CanonicalTeachingPlanSource): CanonicalTeachingPlan["status"] {
  if (source.project.status === "ARCHIVED") return "archived";
  if (source.teachingPlan.status === "APPROVED" || source.teachingPlan.reviewWorkflowStatus === "APPROVED") return "approved";
  if (source.teachingPlan.reviewWorkflowStatus === "CHANGES_REQUESTED") return "changes_requested";
  if (source.teachingPlan.reviewWorkflowStatus === "IN_REVIEW") return "in_review";
  return "draft";
}

function canonicalTemplate(snapshot: CanonicalTeachingPlanSource["templateSnapshot"] | CanonicalTeachingPlanSource["activeTemplate"]) {
  if (!snapshot) return null;
  if (snapshot.profile === "UNKNOWN") throw new Error(`El formato «${snapshot.title} · v${snapshot.version}» no tiene un mapeo seguro para el Plan Docente.`);
  return {
    id: snapshot.id,
    title: snapshot.title,
    version: snapshot.version,
    checksum: snapshot.checksum,
    profile: snapshot.profile,
  };
}

export function buildCanonicalTeachingPlan(source: CanonicalTeachingPlanSource): CanonicalTeachingPlan {
  const templateSnapshot = canonicalTemplate(source.templateSnapshot);
  if (!templateSnapshot) throw new Error("El Plan Docente no conserva el formato institucional con el que fue generado.");
  const activeTemplate = canonicalTemplate(source.activeTemplate);
  return canonicalTeachingPlanSchema.parse({
    $schema: CANONICAL_TEACHING_PLAN_SCHEMA_PATH,
    schemaVersion: CANONICAL_TEACHING_PLAN_SCHEMA_VERSION,
    documentType: "teaching-plan",
    documentId: source.teachingPlan.id,
    projectId: source.project.id,
    language: "es",
    status: canonicalStatus(source),
    planVersion: source.teachingPlan.version,
    format: {
      snapshot: templateSnapshot,
      active: activeTemplate,
      outdated: Boolean(activeTemplate && activeTemplate.id !== templateSnapshot.id),
    },
    metadata: {
      projectName: source.project.name,
      academicLevel: source.project.level,
      faculty: source.project.faculty,
      career: source.project.career,
      professorName: source.project.professorName || source.owner.displayName,
      professorEmail: source.owner.email,
      subject: {
        code: source.project.subjectCode,
        sisCode: source.offering.sisCode,
        metacourseUrl: source.offering.metacourseUrl,
        name: source.project.subjectName,
        typeCode: source.project.subjectType,
        typeName: source.offering.subjectTypeName,
        category: source.offering.category,
      },
      modality: source.project.modality,
      academicPeriod: source.project.academicPeriod,
      totalWeeks: source.project.totalWeeks,
    },
    academicOffer: {
      offeringCode: source.offering.code,
      credits: source.offering.credits,
      acdHours: source.offering.acdHours,
      apeHours: source.offering.apeHours,
      aaHours: source.offering.aaHours,
      totalHours: source.offering.acdHours + source.offering.apeHours + source.offering.aaHours,
      semester: source.offering.semester,
      prerequisites: source.offering.prerequisites,
      learningOutcomes: source.offering.learningOutcomes,
      unitContents: source.offering.unitContents,
      period: {
        startsAt: source.offering.period.startsAt?.toISOString() ?? null,
        endsAt: source.offering.period.endsAt?.toISOString() ?? null,
        bimestralEvaluationStartAt: source.offering.period.bimestralEvaluationStartAt?.toISOString() ?? null,
        bimestralEvaluationEndAt: source.offering.period.bimestralEvaluationEndAt?.toISOString() ?? null,
        recoveryEvaluationStartAt: source.offering.period.recoveryEvaluationStartAt?.toISOString() ?? null,
        recoveryEvaluationEndAt: source.offering.period.recoveryEvaluationEndAt?.toISOString() ?? null,
      },
    },
    contributionMappings: source.mappings,
    teacher: { name: source.owner.displayName, email: source.owner.email, profile: source.teacherProfile },
    bibliography: {
      guideReference: source.project.guideReference,
      guideReferenceImportance: source.project.guideReferenceImportance,
      basicText: source.project.basicBib,
      complementaryText: source.project.complementaryBib,
      reaText: source.project.reaBib ?? "",
      entries: [...source.bibliographyEntries].sort((left, right) => left.sortOrder - right.sortOrder),
    },
    content: source.teachingPlan.content,
    evaluationPolicy: source.evaluationPolicy,
    questionBanks: source.questionBanks.map((bank) => ({
      ...bank,
      approvedAt: bank.approvedAt?.toISOString() ?? null,
    })),
    traceability: {
      templateSnapshotId: source.teachingPlan.templateSnapshotId,
      promptSnapshot: source.promptSnapshot,
      documentSnapshotIds: source.teachingPlan.documentSnapshotIds,
      specificationSnapshotIds: source.teachingPlan.specificationSnapshotIds,
      generatedAt: source.teachingPlan.generatedAt.toISOString(),
      createdAt: source.teachingPlan.createdAt.toISOString(),
      updatedAt: source.teachingPlan.updatedAt.toISOString(),
      teacherReviewedAt: source.teachingPlan.teacherReviewedAt?.toISOString() ?? null,
      methodologyApprovedAt: source.teachingPlan.methodologyApprovedAt?.toISOString() ?? null,
      planningApprovedAt: source.teachingPlan.planningApprovedAt?.toISOString() ?? null,
    },
  });
}

export function canonicalTeachingPlanToWordInput(
  document: CanonicalTeachingPlan,
  logo?: TeachingPlanWordInput["logo"],
  detectedTemplateProfile?: PlanTemplateProfile,
): TeachingPlanWordInput {
  return {
    project: {
      faculty: document.metadata.faculty,
      career: document.metadata.career,
      level: document.metadata.academicLevel,
      subjectName: document.metadata.subject.name,
      subjectCode: document.metadata.subject.code,
      modality: document.metadata.modality,
      academicPeriod: document.metadata.academicPeriod,
      professorName: document.metadata.professorName,
      totalWeeks: document.metadata.totalWeeks,
    },
    period: document.academicOffer.period,
    templateProfile: detectedTemplateProfile ?? (document.format.snapshot.profile === "CURRENT_MODULAR" ? {
      identificationColumns: 4, identificationIncludesTotalHours: false, scheduleColumns: 7, scheduleIncludesInstrument: false, scheduleIncludesGrade: false,
      scheduleFields: ["WEEK", "CONTENTS", "ACD_HOURS", "APE_HOURS", "AA_HOURS", "ACTIVITIES", "RESOURCES"],
      evaluationColumns: 7, evaluationIncludesWorkStrategies: true, evaluationIncludesDeliverable: false,
      evaluationFields: ["COMPONENT", "ACTIVITY", "WORK_STRATEGIES", "INSTRUMENT", "WEEK", "GRADE", "WEIGHT"], confidence: 100, warnings: [], profile: "CURRENT_MODULAR",
    } : document.format.snapshot.profile === "LEGACY_MODULAR" ? {
      identificationColumns: 0, identificationIncludesTotalHours: false, scheduleColumns: 9, scheduleIncludesInstrument: true, scheduleIncludesGrade: true,
      scheduleFields: ["WEEK", "CONTENTS", "ACD_HOURS", "APE_HOURS", "AA_HOURS", "ACTIVITIES", "RESOURCES", "ASSESSMENT_INSTRUMENT", "GRADE"],
      evaluationColumns: 6, evaluationIncludesWorkStrategies: false, evaluationIncludesDeliverable: false,
      evaluationFields: ["COMPONENT", "ACTIVITY", "INSTRUMENT", "WEEK", "GRADE", "WEIGHT"], confidence: 100, warnings: [], profile: "LEGACY_MODULAR",
    } : undefined),
    offering: {
      credits: document.academicOffer.credits,
      acdHours: document.academicOffer.acdHours,
      apeHours: document.academicOffer.apeHours,
      aaHours: document.academicOffer.aaHours,
      semester: document.academicOffer.semester,
      prerequisites: document.academicOffer.prerequisites,
      unitContents: document.academicOffer.unitContents,
      planCategory: document.metadata.subject.category,
    },
    mappings: document.contributionMappings,
    teacher: { ...document.teacher.profile, name: document.teacher.name, email: document.teacher.email },
    bibliography: {
      guideReference: document.bibliography.guideReference,
      guideReferenceImportance: document.bibliography.guideReferenceImportance,
      basic: document.bibliography.basicText,
      complementary: document.bibliography.complementaryText,
      rea: document.bibliography.reaText,
    },
    plan: document.content,
    logo,
  };
}
