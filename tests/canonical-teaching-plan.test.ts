import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  buildCanonicalTeachingPlan,
  canonicalTeachingPlanDocumentSchema,
  canonicalTeachingPlanToWordInput,
  CANONICAL_TEACHING_PLAN_SCHEMA_PATH,
  CANONICAL_TEACHING_PLAN_SCHEMA_VERSION,
  type CanonicalTeachingPlanSource,
} from "../src/canonical-teaching-plan.js";

const ids = {
  project: "00000000-0000-4000-8000-000000000001",
  plan: "00000000-0000-4000-8000-000000000002",
  template: "00000000-0000-4000-8000-000000000003",
  activeTemplate: "00000000-0000-4000-8000-000000000004",
  prompt: "00000000-0000-4000-8000-000000000005",
  policy: "00000000-0000-4000-8000-000000000006",
};

const rules = [
  { code: "AC1" as const, component: "ACD" as const, week: 2, grade: 1, weight: 10 },
  { code: "AC2" as const, component: "AA" as const, week: 4, grade: 1, weight: 10 },
  { code: "AC3" as const, component: "ACD" as const, week: 6, grade: 3, weight: 30 },
  { code: "AC4" as const, component: "APE" as const, week: 7, grade: 2, weight: 20 },
  { code: "AC5" as const, component: "AA" as const, week: 8, grade: 3, weight: 30 },
];

function source(): CanonicalTeachingPlanSource {
  const weeks = Array.from({ length: 8 }, (_, index) => ({
    week: index + 1,
    unitContents: ["Unidad 1: Fundamentos"],
    acdHours: 1,
    apeHours: 0,
    aaHours: 1,
    activities: [`Actividad de la semana ${index + 1}`],
    activityDetails: [],
    resources: ["Aula virtual"],
    assessmentInstrument: "No aplica",
    grade: 0,
  }));
  return {
    project: {
      id: ids.project, name: "Base de Datos", level: "Grado", faculty: "Facultad de Ingenierías", career: "Tecnologías de la Información",
      professorName: "Docente Prueba", subjectCode: "BD-101", subjectName: "Base de Datos", subjectType: "TIPO-A", modality: "En línea",
      academicPeriod: "2026-2", totalWeeks: 8, status: "DRAFT", guideReference: "Referencia", guideReferenceImportance: "Importancia",
      basicBib: "Bibliografía básica", complementaryBib: "Bibliografía complementaria", reaBib: "REA",
    },
    owner: { displayName: "Docente Prueba", email: "docente@example.com" },
    offering: {
      code: "OF-1", sisCode: "SIS-1", metacourseUrl: "https://example.com/metacurso", subjectTypeName: "Conceptual", category: "CONCEPTUAL" as const,
      credits: 4, acdHours: 8, apeHours: 0, aaHours: 8, semester: "1", prerequisites: [], learningOutcomes: ["Aplica fundamentos"],
      unitContents: ["Unidad 1: Fundamentos"],
      period: { startsAt: null, endsAt: null, bimestralEvaluationStartAt: null, bimestralEvaluationEndAt: null, recoveryEvaluationStartAt: null, recoveryEvaluationEndAt: null },
    },
    mappings: [{ learningOutcome: "Aplica fundamentos", contribution: "INITIAL" as const, professionalCompetencies: ["Competencia"], graduateProfileResults: ["Resultado"], utplGenericCompetencies: ["Trabajo colaborativo" as const] }],
    teacherProfile: { thirdLevelDegrees: ["Ingeniero"], fourthLevelDegrees: [], faculty: "Facultad de Ingenierías", department: "Ciencias de la Computación", phone: "0999999999", shortCv: "Experiencia docente y profesional suficiente para la prueba canónica." },
    bibliographyEntries: [],
    teachingPlan: {
      id: ids.plan, status: "DRAFT", version: 3, templateSnapshotId: ids.template, promptSnapshotId: ids.prompt, documentSnapshotIds: [], specificationSnapshotIds: [],
      generatedAt: new Date("2026-08-20T20:00:00.000Z"), createdAt: new Date("2026-08-20T20:00:00.000Z"), updatedAt: new Date("2026-08-20T20:10:00.000Z"),
      teacherReviewedAt: null, methodologyApprovedAt: new Date("2026-08-20T20:05:00.000Z"), planningApprovedAt: null, reviewWorkflowStatus: null,
      content: {
        presentation: "Presentación académica suficientemente extensa para validar el contrato canónico.", guideTitle: "Guía de Base de Datos", guideDescription: "Descripción académica suficiente para la validación.",
        sequences: [{ learningOutcome: "Aplica fundamentos", methodology: "Aprendizaje activo", tac: ["Aula virtual"], weeks }],
        evaluatedActivities: rules.map((rule) => ({ ...rule, activity: `Actividad ${rule.code}`, workStrategies: "Trabajo guiado", instrument: "Rúbrica" })),
        curricularAdaptations: "Adaptaciones curriculares institucionales suficientemente extensas para validar el documento.",
      },
    },
    templateSnapshot: { id: ids.template, title: "Formato Plan Docente", version: 2, checksum: "abc", profile: "CURRENT_MODULAR" as const },
    activeTemplate: { id: ids.activeTemplate, title: "Formato Plan Docente", version: 3, checksum: "def", profile: "CURRENT_MODULAR" as const },
    promptSnapshot: { id: ids.prompt, title: "Prompt Plan", version: 4, checksum: "ghi" },
    evaluationPolicy: { id: ids.policy, category: "CONCEPTUAL" as const, version: 1, title: "Distribución institucional - Conceptual", rules },
    questionBanks: [],
  };
}

test("crea un JSON canónico del Plan Docente independiente del formato de salida", () => {
  const document = buildCanonicalTeachingPlan(source());
  assert.equal(document.$schema, CANONICAL_TEACHING_PLAN_SCHEMA_PATH);
  assert.equal(document.schemaVersion, CANONICAL_TEACHING_PLAN_SCHEMA_VERSION);
  assert.equal(document.documentType, "teaching-plan");
  assert.equal(document.format.snapshot.version, 2);
  assert.equal(document.format.active?.version, 3);
  assert.equal(document.format.outdated, true);
  assert.equal(document.content.sequences[0]?.weeks.length, 8);
  assert.equal(document.evaluationPolicy.rules.reduce((sum, item) => sum + item.grade, 0), 10);
  assert.equal(canonicalTeachingPlanDocumentSchema.parse(document).documentId, ids.plan);
});

test("el renderizador Word recibe los mismos datos canónicos aunque cambie la versión de formato activa", () => {
  const document = buildCanonicalTeachingPlan(source());
  const input = canonicalTeachingPlanToWordInput(document);
  assert.equal(input.templateProfile?.profile, "CURRENT_MODULAR");
  assert.equal(input.project.subjectCode, "BD-101");
  assert.equal(input.plan, document.content);
  assert.equal(input.offering.planCategory, "CONCEPTUAL");
});

test("el JSON canónico incorpora bancos de preguntas estructurados sin mezclarlos con el Word", () => {
  const input = source();
  input.teachingPlan.content.evaluatedActivities[0]!.instrument = "Cuestionario";
  input.teachingPlan.content.evaluatedActivities[0]!.instrumentConfig = {
    type: "QUESTIONNAIRE", title: "Cuestionario AC1", maximumScore: 10,
    questionnaire: { gradingMode: "HIGHEST_GRADE", questionCount: 1, timeMinutes: 20 }, criteria: [],
  };
  input.questionBanks.push({
    id: "00000000-0000-4000-8000-000000000007", evaluatedCode: "AC1", minimumRequired: 1,
    topicScope: ["Unidad 1: Fundamentos"], typeConfiguration: [{ type: "TRUE_FALSE", quantity: 1 }],
    generationInstructions: "", status: "APPROVED", version: 1, approvedAt: new Date("2026-08-20T20:20:00.000Z"),
    questions: [{
      id: "00000000-0000-4000-8000-000000000008", sortOrder: 1, type: "TRUE_FALSE", topic: "Unidad 1: Fundamentos",
      prompt: "Una base de datos organiza información estructurada.",
      options: [{ id: "V", text: "Verdadero", matchText: "" }, { id: "F", text: "Falso", matchText: "" }],
      answerKey: ["V"], feedbackCorrect: "Correcto: identifica la finalidad básica.", feedbackIncorrect: "Revise el concepto de base de datos.",
      source: "AI", version: 1,
    }],
  });
  const document = buildCanonicalTeachingPlan(input);
  assert.equal(document.questionBanks.length, 1);
  assert.equal(document.questionBanks[0]?.questions[0]?.answerKey[0], "V");
  assert.equal(canonicalTeachingPlanToWordInput(document).plan, document.content);
});

test("el esquema JSON publicado identifica el contrato canónico v1 del Plan Docente", async () => {
  const schema = JSON.parse(await readFile(new URL("../schemas/teaching-plan-canonical-v1.schema.json", import.meta.url), "utf8"));
  assert.equal(schema.$id, CANONICAL_TEACHING_PLAN_SCHEMA_PATH);
  assert.equal(schema.properties.schemaVersion.const, CANONICAL_TEACHING_PLAN_SCHEMA_VERSION);
  assert.equal(schema.properties.documentType.const, "teaching-plan");
});
