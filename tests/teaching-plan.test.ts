import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import test from "node:test";
import JSZip from "jszip";
import * as XLSX from "xlsx";
import {
  assertContributionCoverage,
  assertTeachingPlanConsistency,
  canonicalizeTeachingPlanUnitContents,
  buildDidacticGuideImportance,
  buildDidacticGuideReference,
  evaluationRulesFor,
  planMatrixRows,
  scaleInstrumentScoreToActivityGrade,
  assertTeachingPlanInstrumentConfig,
  teachingPlanContentSchema,
  teachingPlanReviewChecks,
  TeachingPlanConsistencyError,
  type TeachingPlanContent,
} from "../src/academic/teaching-plan-policy.js";
import { parseAcademicOfferWorkbook } from "../src/academic/offer-import.js";
import { buildTeachingPlanWord } from "../src/teaching-plan-word.js";

const conceptualRules = evaluationRulesFor("CONCEPTUAL");

function rubricInstrumentConfig() {
  return {
    type: "RUBRIC" as const,
    title: "Rúbrica analítica",
    maximumScore: 10 as const,
    questionnaire: null,
    criteria: ["Pertinencia", "Ortografía y redacción", "Aplicación teórica", "Referencias bibliográficas"].map((label) => ({
      label,
      levels: [
        { label: "Excelente", description: "Cumple plenamente el criterio.", score: 2.5 },
        { label: "Bueno", description: "Cumple adecuadamente el criterio.", score: 1.75 },
        { label: "Regular", description: "Cumple parcialmente el criterio.", score: 1 },
        { label: "Deficiente", description: "No cumple el criterio.", score: 0 },
      ],
    })),
  };
}

const plan: TeachingPlanContent = teachingPlanContentSchema.parse({
  presentation: "Esta asignatura desarrolla capacidades de análisis y aplicación mediante una secuencia modular coherente con los resultados institucionales.",
  curricularAdaptations: "Texto institucional de adaptaciones curriculares definido por la Universidad para atender necesidades educativas y apoyar el desarrollo de las competencias del estudiante.",
  guideTitle: "Guía didáctica de Diseño curricular",
  guideDescription: "Documento que acompaña el aprendizaje autónomo y orienta las actividades previstas durante el periodo académico.",
  sequences: [
    {
      learningOutcome: "Analiza principios de diseño curricular.",
      methodology: "Aprendizaje basado en problemas",
      tac: ["Aula virtual", "Foro académico"],
      weeks: Array.from({ length: 8 }, (_, index) => {
        const week = index + 1;
        const rule = conceptualRules.find((item) => item.week === week);
        const description = rule ? `Actividad ${rule.code}` : `Actividad de aprendizaje de la semana ${week}`;
        return {
          week,
          unitContents: [index < 4 ? "Unidad 1. Fundamentos" : "Unidad 2. Aplicación"],
          acdHours: 1,
          apeHours: 1,
          aaHours: 2,
          activities: [description, `Actividad APE semana ${week}`, `Actividad AA semana ${week}`],
          activityDetails: [
            { component: "ACD", description: rule?.component === "ACD" ? description : `Actividad ACD semana ${week}`, resource: "Videoconferencia / aula virtual", hours: 1, evaluationCode: rule?.component === "ACD" ? rule.code : null },
            { component: "APE", description: rule?.component === "APE" ? description : `Actividad APE semana ${week}`, resource: "Caso práctico / EVA", hours: 1, evaluationCode: rule?.component === "APE" ? rule.code : null },
            { component: "AA", description: rule?.component === "AA" ? description : `Actividad AA semana ${week}`, resource: "Bibliografía básica", hours: 2, evaluationCode: rule?.component === "AA" ? rule.code : null },
          ],
          resources: ["Videoconferencia / aula virtual", "Caso práctico / EVA", "Bibliografía básica"],
          assessmentInstrument: rule ? "Rúbrica analítica" : "Lista de verificación formativa",
          grade: rule?.grade ?? 0,
        };
      }),
    },
  ],
  evaluatedActivities: conceptualRules.map((rule) => ({
    ...rule,
    activity: `Actividad ${rule.code}`,
    workStrategies: "Aplicación contextualizada y entrega en el aula virtual.",
    instrument: "Rúbrica analítica",
    instrumentConfig: rubricInstrumentConfig(),
  })),
});

test("mantiene la distribución conceptual corregida del formato institucional", () => {
  assert.deepEqual(evaluationRulesFor("CONCEPTUAL").map(({ code, week, weight }) => ({ code, week, weight })), [
    { code: "AC1", week: 2, weight: 10 },
    { code: "AC2", week: 4, weight: 10 },
    { code: "AC3", week: 6, weight: 30 },
    { code: "AC4", week: 7, weight: 20 },
    { code: "AC5", week: 8, weight: 30 },
  ]);
});

test("convierte el puntaje EVA sobre 10 a la calificación real de la actividad", () => {
  assert.equal(scaleInstrumentScoreToActivityGrade(10, 3), 3);
  assert.equal(scaleInstrumentScoreToActivityGrade(8, 3), 2.4);
  assert.equal(scaleInstrumentScoreToActivityGrade(5, 0.5), 0.25);
});

test("valida instrumentos estructurados sobre 10 puntos", () => {
  assert.doesNotThrow(() => assertTeachingPlanInstrumentConfig(rubricInstrumentConfig(), "AC1"));
  const invalid = rubricInstrumentConfig();
  invalid.criteria[0]!.levels[0]!.score = 3;
  assert.throws(() => assertTeachingPlanInstrumentConfig(invalid, "AC1"), /exactamente 10 puntos/);
});

test("valida cuestionario, lista de cotejo y escala de valoración para EVA", () => {
  assert.doesNotThrow(() => assertTeachingPlanInstrumentConfig({
    type: "QUESTIONNAIRE", title: "Cuestionario", maximumScore: 10, criteria: [],
    questionnaire: { gradingMode: "HIGHEST_GRADE", questionCount: 12, timeMinutes: 25 },
  }, "AC1"));
  const labels = ["Pertinencia", "Ortografía", "Aplicación teórica", "Referencias bibliográficas"];
  assert.doesNotThrow(() => assertTeachingPlanInstrumentConfig({
    type: "CHECKLIST", title: "Lista de cotejo", maximumScore: 10, questionnaire: null,
    criteria: labels.map((label) => ({ label, levels: [
      { label: "Sí", description: "Cumple el criterio.", score: 2.5 },
      { label: "No", description: "No cumple completamente el criterio.", score: 1.75 },
    ] })),
  }, "AC2"));
  assert.doesNotThrow(() => assertTeachingPlanInstrumentConfig({
    type: "RATING_SCALE", title: "Escala de valoración", maximumScore: 10, questionnaire: null,
    criteria: labels.map((label) => ({ label, levels: [
      { label: "Muy bien", description: "Cumple plenamente.", score: 2.5 },
      { label: "Bien", description: "Cumple adecuadamente.", score: 1.75 },
      { label: "Regular", description: "Cumple parcialmente.", score: 1 },
      { label: "Deficiente", description: "No cumple.", score: 0 },
    ] })),
  }, "AC3"));
});

test("valida semanas, horas, resultados, contenidos y evaluación del plan", () => {
  assert.doesNotThrow(() => assertTeachingPlanConsistency(plan, {
    totalWeeks: 8,
    acdHours: 8,
    apeHours: 8,
    aaHours: 16,
    learningOutcomes: ["Analiza principios de diseño curricular."],
    unitContents: ["Unidad 1. Fundamentos", "Unidad 2. Aplicación"],
    planCategory: "CONCEPTUAL",
    evaluationRules: conceptualRules,
  }));
  assert.equal(planMatrixRows(plan).length, 8);
});

test("controla que las horas de las actividades coincidan con ACD, APE y AA de cada semana", () => {
  const invalid = structuredClone(plan);
  invalid.sequences[0]!.weeks[0]!.activityDetails[0]!.hours = 2;
  assert.throws(() => assertTeachingPlanConsistency(invalid, {
    totalWeeks: 8, acdHours: 8, apeHours: 8, aaHours: 16,
    learningOutcomes: ["Analiza principios de diseño curricular."],
    unitContents: ["Unidad 1. Fundamentos", "Unidad 2. Aplicación"],
    planCategory: "CONCEPTUAL",
    evaluationRules: conceptualRules,
  }), /distribución de horas por actividad/);
});

test("resume las validaciones automáticas para la vista previa del Plan Docente", () => {
  const checks = teachingPlanReviewChecks(plan, {
    totalWeeks: 8,
    acdHours: 8,
    apeHours: 8,
    aaHours: 16,
    learningOutcomes: ["Analiza principios de diseño curricular."],
    unitContents: ["Unidad 1. Fundamentos", "Unidad 2. Aplicación"],
    planCategory: "CONCEPTUAL",
    evaluationRules: conceptualRules,
  });
  assert.equal(checks.length, 9);
  assert.ok(checks.every((check) => check.ok));
  assert.match(checks.find((check) => check.code === "WEEKS")!.detail, /Semanas 1 a 8/);
});

test("la vista previa identifica horas y totales de evaluación inconsistentes", () => {
  const invalid = structuredClone(plan);
  invalid.sequences[0]!.weeks[0]!.acdHours = 2;
  invalid.evaluatedActivities[0]!.weight = 9;
  const checks = teachingPlanReviewChecks(invalid, {
    totalWeeks: 8,
    acdHours: 8,
    apeHours: 8,
    aaHours: 16,
    learningOutcomes: ["Analiza principios de diseño curricular."],
    unitContents: ["Unidad 1. Fundamentos", "Unidad 2. Aplicación"],
    planCategory: "CONCEPTUAL",
    evaluationRules: conceptualRules,
  });
  assert.equal(checks.find((check) => check.code === "HOURS")!.ok, false);
  assert.equal(checks.find((check) => check.code === "TOTALS")!.ok, false);
  assert.equal(checks.find((check) => check.code === "EVALUATION")!.ok, false);
});

test("rechaza contenidos inventados por la generación", () => {
  const invalid = structuredClone(plan);
  invalid.sequences[0]!.weeks[0]!.unitContents = ["Unidad inventada"];
  assert.throws(() => assertTeachingPlanConsistency(invalid, {
    totalWeeks: 8,
    acdHours: 8,
    apeHours: 8,
    aaHours: 16,
    learningOutcomes: ["Analiza principios de diseño curricular."],
    unitContents: ["Unidad 1. Fundamentos", "Unidad 2. Aplicación"],
    planCategory: "CONCEPTUAL",
    evaluationRules: conceptualRules,
  }), /no consta literalmente/);
});

test("recupera los literales de la oferta cuando la IA agrega numeración de presentación", () => {
  const generated = structuredClone(plan);
  generated.sequences[0]!.weeks[0]!.unitContents = [
    "Unidad 1: DERECHO Y TECNOLOGÍAS DE LA INFORMACIÓN",
    "1.1. Nociones preliminares.",
    "1.1.1. Concepto y alcance del Derecho en entornos digitales",
  ];
  // Esta prueba aísla la reconciliación de literales. Las demás semanas del
  // fixture utilizan contenidos distintos que no pertenecen a este catálogo.
  generated.sequences[0]!.weeks = generated.sequences[0]!.weeks.slice(0, 1);
  const canonical = [
    "UNIDAD: DERECHO Y TECNOLOGÍAS DE LA INFORMACIÓN",
    "CONTENIDO: Nociones preliminares",
    "SUBCONTENIDO: Concepto y alcance del Derecho en entornos digitales",
  ];
  const normalized = canonicalizeTeachingPlanUnitContents(generated, canonical);
  assert.deepEqual(normalized.sequences[0]!.weeks[0]!.unitContents, canonical);
});

test("informa el contenido concreto cuando la IA propone un elemento ajeno a la oferta", () => {
  const generated = structuredClone(plan);
  generated.sequences[0]!.weeks[0]!.unitContents = ["Unidad inventada por la IA"];
  assert.throws(
    () => canonicalizeTeachingPlanUnitContents(generated, ["UNIDAD: Fundamentos institucionales"]),
    (error) => {
      assert.ok(error instanceof TeachingPlanConsistencyError);
      assert.equal(error.statusCode, 422);
      assert.match(error.message, /Unidad inventada por la IA/);
      assert.match(error.message, /no consta/);
      return true;
    },
  );
});


test("permite repetir un resultado de aprendizaje para cubrir varios resultados del perfil", () => {
  const mappings = [
    { learningOutcome: "RA1", contribution: "MIDDLE" as const, professionalCompetencies: ["CP1"], graduateProfileResults: ["RP1"], utplGenericCompetencies: ["Trabajo colaborativo"] },
    { learningOutcome: "RA1", contribution: "MIDDLE" as const, professionalCompetencies: ["CP1"], graduateProfileResults: ["RP2"], utplGenericCompetencies: ["Trabajo colaborativo"] },
    { learningOutcome: "RA1", contribution: "MIDDLE" as const, professionalCompetencies: ["CP1"], graduateProfileResults: ["RP3"], utplGenericCompetencies: ["Trabajo colaborativo"] },
  ];
  assert.doesNotThrow(() => assertContributionCoverage(mappings, {
    learningOutcomes: ["RA1"], professionalProfileCompetencies: ["CP1"],
    graduateProfileResults: ["RP1", "RP2", "RP3"], utplGenericCompetencies: ["Trabajo colaborativo"],
  }));
});

test("rechaza una matriz que deja elementos institucionales sin relación", () => {
  const mappings = [
    { learningOutcome: "RA1", contribution: "MIDDLE" as const, professionalCompetencies: ["CP1"], graduateProfileResults: ["RP1"], utplGenericCompetencies: ["Trabajo colaborativo"] },
  ];
  assert.throws(() => assertContributionCoverage(mappings, {
    learningOutcomes: ["RA1", "RA2"], professionalProfileCompetencies: ["CP1"],
    graduateProfileResults: ["RP1", "RP2"], utplGenericCompetencies: ["Trabajo colaborativo"],
  }), /faltan/);
});


test("rechaza dos relaciones con la misma combinación institucional", () => {
  const mappings = [
    { learningOutcome: "RA1", contribution: "MIDDLE" as const, professionalCompetencies: ["CP1"], graduateProfileResults: ["RP1"], utplGenericCompetencies: ["Trabajo colaborativo"] },
    { learningOutcome: "RA1", contribution: "FINAL" as const, professionalCompetencies: ["CP1"], graduateProfileResults: ["RP1"], utplGenericCompetencies: ["Trabajo colaborativo"] },
  ];
  assert.throws(() => assertContributionCoverage(mappings, {
    learningOutcomes: ["RA1"], professionalProfileCompetencies: ["CP1"],
    graduateProfileResults: ["RP1"], utplGenericCompetencies: ["Trabajo colaborativo"],
  }), /misma combinación/);
});

function addSheet(workbook: XLSX.WorkBook, name: string, rows: unknown[]) {
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), name);
}

test("interpreta la oferta académica normalizada en varias hojas", () => {
  const workbook = XLSX.utils.book_new();
  addSheet(workbook, "OFERTAS", [{
    id_oferta: "OF-001", periodo_codigo: "2026-2", periodo_nombre: "Octubre 2026 - Abril 2027",
    fecha_inicio: "2026-10-01", fecha_fin: "2027-04-30", asignatura_codigo: "EDU-101",
    asignatura_nombre: "Diseño curricular", codigo_sis: "SIS-EDU-101", url_metacurso: "https://campus.example.edu/meta/EDU-101",
    tipo_asignatura_codigo: "TEORICA", numero_semanas: 8,
    creditos: 4, horas_acd: 8, horas_ape: 8, horas_aa: 16, nivel_codigo: "GRADO",
    nivel_nombre: "Grado", modalidad_codigo: "EN-LINEA", modalidad_nombre: "En línea",
    facultad_codigo: "FAC-EDU", facultad_nombre: "Facultad de Educación", carrera_codigo: "PRG-EDU",
    carrera_nombre: "Educación", semestre: "Primer semestre", descripcion: "Asignatura de prueba",
    prerrequisitos: "EDU-100",
  }]);
  addSheet(workbook, "RA_ASIGNATURA", [
    { id_oferta: "OF-001", orden: 1, resultado_aprendizaje: "Analiza principios." },
    { id_oferta: "OF-001", orden: 2, resultado_aprendizaje: "Aplica principios." },
  ]);
  addSheet(workbook, "RA_PERFIL", [{ id_oferta: "OF-001", orden: 1, resultado_perfil_egreso: "Diseña propuestas." }]);
  addSheet(workbook, "COMPETENCIAS", [
    { id_oferta: "OF-001", tipo: "PROFESIONAL", orden: 1, descripcion: "Diseña experiencias." },
    { id_oferta: "OF-001", tipo: "GENERICA_UTPL", orden: 1, descripcion: "Trabajo colaborativo" },
  ]);
  addSheet(workbook, "UNIDADES", [
    { id_oferta: "OF-001", orden: 1, unidad_contenido: "Unidad 1. Fundamentos" },
    { id_oferta: "OF-001", orden: 2, unidad_contenido: "Unidad 2. Aplicación" },
  ]);
  addSheet(workbook, "DOCENTES", [{ cedula: "1100000000", nombres: "Ana", apellidos: "Docente", correo: "ana@example.edu" }]);
  addSheet(workbook, "ASIGNACIONES", [{ id_oferta: "OF-001", cedula: "1100000000" }]);
  const bytes = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
  const parsed = parseAcademicOfferWorkbook("oferta.xlsx", bytes.toString("base64"));
  assert.equal(parsed.offerings[0]?.learningOutcomes.length, 2);
  assert.equal(parsed.offerings[0]?.sisCode, "SIS-EDU-101");
  assert.equal(parsed.offerings[0]?.metacourseUrl, "https://campus.example.edu/meta/EDU-101");
  assert.equal(parsed.assignments[0]?.offeringCode, "OF-001");
});


test("crea una referencia editable de la guía didáctica con datos de la asignatura", () => {
  const reference = buildDidacticGuideReference({
    subjectName: "Derecho Informático",
    subjectCode: "DER-210",
    career: "Derecho",
    academicPeriod: "Octubre 2026 - Febrero 2027",
  });
  assert.match(reference, /Universidad Técnica Particular de Loja/);
  assert.match(reference, /\(2026\)/);
  assert.match(reference, /Derecho Informático/);
  assert.match(reference, /DER-210/);
});

test("crea una importancia editable de la guía didáctica para el estudiante", () => {
  const importance = buildDidacticGuideImportance({ subjectName: "Derecho Informático" });
  assert.match(importance, /Derecho Informático/);
  assert.match(importance, /aprendizaje autónomo/i);
  assert.match(importance, /resultados de aprendizaje/i);
});

test("genera un Word con plan docente y aprobación externa", async () => {
  const buffer = await buildTeachingPlanWord({
    project: {
      faculty: "Facultad de Educación", career: "Educación", subjectName: "Diseño curricular",
      subjectCode: "EDU-101", modality: "En línea", academicPeriod: "Octubre 2026 - Abril 2027",
      professorName: "Ana Docente", totalWeeks: 8,
    },
    period: {
      startsAt: "2026-10-05T00:00:00.000Z",
      bimestralEvaluationStartAt: "2026-11-27T00:00:00.000Z",
      bimestralEvaluationEndAt: "2026-12-01T00:00:00.000Z",
      recoveryEvaluationStartAt: "2027-02-08T00:00:00.000Z",
      recoveryEvaluationEndAt: "2027-02-12T00:00:00.000Z",
    },
    templateProfile: {
      identificationColumns: 4, scheduleColumns: 7, scheduleIncludesInstrument: false, scheduleIncludesGrade: false,
      evaluationColumns: 7, evaluationIncludesWorkStrategies: true, profile: "CURRENT_MODULAR",
    },
    offering: {
      credits: 4, acdHours: 8, apeHours: 8, aaHours: 16, semester: "Primer semestre",
      prerequisites: ["EDU-100"], unitContents: ["Unidad 1. Fundamentos", "Unidad 2. Aplicación"], planCategory: "CONCEPTUAL",
    },
    mappings: [{
      learningOutcome: "Analiza principios de diseño curricular.", contribution: "MIDDLE",
      professionalCompetencies: ["Diseña experiencias."],
      graduateProfileResults: ["Diseña propuestas."], utplGenericCompetencies: ["Trabajo colaborativo"],
    }],
    teacher: {
      name: "Ana Docente", email: "ana@example.edu", thirdLevelDegrees: ["Licenciada en Educación"],
      fourthLevelDegrees: ["Magíster en Educación"], faculty: "Facultad de Educación",
      department: "Ciencias de la Educación", phone: "0999999999",
      shortCv: "Docente universitaria con experiencia en diseño curricular y educación en línea.",
    },
    bibliography: {
      guideReference: "Universidad Técnica Particular de Loja. (2026). Guía didáctica de Diseño curricular (EDU-101). Educación.",
      guideReferenceImportance: "Orienta al estudiante en la secuencia de contenidos, actividades y recursos de la asignatura.",
      basic: "Autor. (2025). Texto básico.", complementary: "Autor. (2024). Texto complementario.",
      rea: "Recurso abierto — https://example.edu/rea",
    },
    plan,
  });
  if (process.env.TEACHING_PLAN_RENDER_PATH) {
    await writeFile(process.env.TEACHING_PLAN_RENDER_PATH, buffer);
  }
  assert.ok(buffer.length > 10_000);
  const archive = await JSZip.loadAsync(buffer);
  const xml = await archive.file("word/document.xml")!.async("string");
  assert.match(xml, /PLAN DOCENTE/i);
  assert.match(xml, /Guía didáctica de Diseño curricular/);
  assert.match(xml, /Orienta al estudiante en la secuencia de contenidos/);
  assert.match(xml, /\[ACD\] \[AC1\]/);
  assert.doesNotMatch(xml, /\[AC1\] \[ACD\]/);
  assert.match(xml, /a\) Universidad Técnica Particular de Loja/);
  assert.match(xml, /b\) Autor\. \(2025\)\. Texto básico\./);
  assert.match(xml, /a\) Autor\. \(2024\)\. Texto complementario\./);
  assert.match(xml, /Estrategias de trabajo/);
  assert.doesNotMatch(xml, /configuración EVA sobre 10 puntos/);
  assert.doesNotMatch(xml, />Excelente</);
  assert.match(xml, /27\/11\/2026 al 01\/12\/2026/);
  assert.match(xml, /08\/02\/2027 al 12\/02\/2027/);
  const recoveryHeadingIndex = xml.indexOf("EVALUACIÓN DE RECUPERACIÓN");
  const recoveryTableIndex = xml.indexOf("Actividades académicas", recoveryHeadingIndex);
  const recoveryWeekIndex = xml.indexOf("Semana 10", recoveryTableIndex);
  const recoveryDateIndex = xml.indexOf("08/02/2027 al 12/02/2027", recoveryWeekIndex);
  assert.ok(recoveryHeadingIndex >= 0 && recoveryHeadingIndex < recoveryTableIndex);
  assert.ok(recoveryTableIndex < recoveryWeekIndex && recoveryWeekIndex < recoveryDateIndex);
  assert.doesNotMatch(xml, /Fecha: 08\/02\/2027 al 12\/02\/2027/);
  assert.doesNotMatch(xml, /Semana 10 · 70% de la evaluación de recuperación más 30% del acumulado del módulo\./);
  assert.match(xml, /Unidad 1: Fundamentos/);
  assert.doesNotMatch(xml, /Descripción general/);
  assert.match(xml, /Texto institucional de adaptaciones curriculares definido por la Universidad/);
  assert.match(xml, /Esta sección se completa y aprueba fuera del sistema/);
  assert.match(xml, /Director\/a de carrera/);
  const pageMarginTags = [...xml.matchAll(/<w:pgMar\b[^>]*>/gu)].map((match) => match[0]);
  assert.ok(pageMarginTags.some((tag) =>
    tag.includes('w:top="900"')
    && tag.includes('w:right="900"')
    && tag.includes('w:bottom="900"')
    && tag.includes('w:left="900"')),
  "las páginas verticales conservan márgenes uniformes");
  assert.match(xml, /<w:tblW\b[^>]*w:w="10106"[^>]*>/u);
  const landscapeSections = [...xml.matchAll(/<w:pgSz\b[^>]*w:orient="landscape"[^>]*>/gu)];
  assert.ok(landscapeSections.length >= 2, "las secciones D y E se exportan en páginas horizontales separadas");
  assert.match(xml, /<w:tblW\b[^>]*w:w="15398"[^>]*>/u);
  assert.match(xml, /<w:spacing\b[^>]*w:after="1300"[^>]*>/u);
});
