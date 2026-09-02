import JSZip from "jszip";

export const planTemplateScheduleFields = [
  "WEEK",
  "CONTENTS",
  "ACD_HOURS",
  "APE_HOURS",
  "AA_HOURS",
  "ACTIVITIES",
  "RESOURCES",
  "ASSESSMENT_INSTRUMENT",
  "GRADE",
] as const;

export type PlanTemplateScheduleField = typeof planTemplateScheduleFields[number];

export const planTemplateEvaluationFields = [
  "COMPONENT",
  "ACTIVITY",
  "WORK_STRATEGIES",
  "DELIVERABLE",
  "INSTRUMENT",
  "WEEK",
  "GRADE",
  "WEIGHT",
] as const;

export type PlanTemplateEvaluationField = typeof planTemplateEvaluationFields[number];

export type PlanTemplateProfile = {
  identificationColumns: number;
  identificationIncludesTotalHours?: boolean;
  scheduleColumns: number;
  scheduleIncludesInstrument: boolean;
  scheduleIncludesGrade: boolean;
  scheduleFields?: PlanTemplateScheduleField[];
  evaluationColumns: number;
  evaluationIncludesWorkStrategies: boolean;
  evaluationIncludesDeliverable?: boolean;
  evaluationFields?: PlanTemplateEvaluationField[];
  confidence?: number;
  warnings?: string[];
  profile: "CURRENT_MODULAR" | "LEGACY_MODULAR" | "DYNAMIC_MODULAR" | "UNKNOWN";
};

type FieldDetector<T extends string> = readonly [field: T, pattern: RegExp];

const scheduleDetectors: readonly FieldDetector<PlanTemplateScheduleField>[] = [
  ["WEEK", /\bsemana\b/u],
  ["CONTENTS", /\bcontenidos?\b/u],
  ["ACD_HOURS", /\bacd\b/u],
  ["APE_HOURS", /\bape\b/u],
  ["AA_HOURS", /\baa\b/u],
  ["ACTIVITIES", /actividades?\s+de\s+aprendizaje/u],
  ["RESOURCES", /recursos?\s+de\s+aprendizaje/u],
  ["ASSESSMENT_INSTRUMENT", /instrumentos?\s+de\s+evaluacion/u],
  ["GRADE", /\b(?:calificacion|clificacion)\b/u],
] as const;

const evaluationDetectors: readonly FieldDetector<PlanTemplateEvaluationField>[] = [
  ["COMPONENT", /\bcomponente\b/u],
  ["ACTIVITY", /\bactividad\b/u],
  ["WORK_STRATEGIES", /estrategias?\s+de\s+trabajo/u],
  ["DELIVERABLE", /\b(?:entregable|estregable)\b/u],
  ["INSTRUMENT", /instrumentos?\s+de\s+evaluacion/u],
  ["WEEK", /\bsemana(?:\s+de)?\s+ejecucion\b|\bsemana\b/u],
  ["GRADE", /\b(?:calificacion|clificacion)\b/u],
  ["WEIGHT", /\bpeso\b/u],
] as const;

const currentScheduleOrder: PlanTemplateScheduleField[] = [
  "WEEK", "CONTENTS", "ACD_HOURS", "APE_HOURS", "AA_HOURS", "ACTIVITIES", "RESOURCES",
];
const legacyScheduleOrder: PlanTemplateScheduleField[] = [
  "WEEK", "CONTENTS", "ACD_HOURS", "APE_HOURS", "AA_HOURS", "ACTIVITIES", "RESOURCES", "ASSESSMENT_INSTRUMENT", "GRADE",
];
const currentEvaluationOrder: PlanTemplateEvaluationField[] = [
  "COMPONENT", "ACTIVITY", "WORK_STRATEGIES", "INSTRUMENT", "WEEK", "GRADE", "WEIGHT",
];
const legacyEvaluationOrder: PlanTemplateEvaluationField[] = [
  "COMPONENT", "ACTIVITY", "INSTRUMENT", "WEEK", "GRADE", "WEIGHT",
];

function decodeXmlText(value: string) {
  return value
    .replace(/&amp;/gu, "&")
    .replace(/&lt;/gu, "<")
    .replace(/&gt;/gu, ">")
    .replace(/&quot;/gu, '"')
    .replace(/&apos;/gu, "'")
    .replace(/&#(\d+);/gu, (_match, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/giu, (_match, code) => String.fromCodePoint(Number.parseInt(code, 16)));
}

function normalizeSemanticText(value: string) {
  return decodeXmlText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLocaleLowerCase("es")
    .replace(/[‐‑‒–—]/gu, "-")
    .replace(/\bcl\s+ificacion\b/gu, "clificacion")
    .replace(/\bestr\s+egable\b/gu, "estregable")
    .replace(/\bc\s+omponente\b/gu, "componente")
    .replace(/\s+/gu, " ")
    .trim();
}

function tableText(xml: string) {
  return decodeXmlText([...xml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/gu)].map((match) => match[1] ?? "").join(" "))
    .replace(/\s+/gu, " ")
    .trim();
}

function tableColumns(xml: string) {
  const grid = xml.match(/<w:tblGrid>([\s\S]*?)<\/w:tblGrid>/u)?.[1] ?? "";
  return [...grid.matchAll(/<w:gridCol\b/gu)].length;
}

function cellText(xml: string) {
  return normalizeSemanticText([...xml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/gu)].map((match) => match[1] ?? "").join(" "));
}

function cellGridSpan(xml: string) {
  const raw = xml.match(/<w:gridSpan\b[^>]*w:val="(\d+)"[^>]*\/?>(?:<\/w:gridSpan>)?/u)?.[1];
  const parsed = Number.parseInt(raw || "1", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

function fieldInText<T extends string>(text: string, detectors: readonly FieldDetector<T>[]): T[] {
  return detectors.filter(([, pattern]) => pattern.test(text)).map(([field]) => field);
}

function tableFieldLayout<T extends string>(xml: string, detectors: readonly FieldDetector<T>[], columnCount: number): T[] {
  const rows = [...xml.matchAll(/<w:tr\b[\s\S]*?<\/w:tr>/gu)].slice(0, 4).map((match) => match[0]);
  const byColumn = new Map<number, { field: T; row: number }>();
  for (const [rowIndex, row] of rows.entries()) {
    let column = 0;
    const cells = [...row.matchAll(/<w:tc\b[\s\S]*?<\/w:tc>/gu)].map((match) => match[0]);
    for (const cell of cells) {
      const span = cellGridSpan(cell);
      const text = cellText(cell);
      const fields = fieldInText(text, detectors);
      if (fields.length === 1 && column < columnCount) {
        const existing = byColumn.get(column);
        if (!existing || rowIndex < existing.row) byColumn.set(column, { field: fields[0]!, row: rowIndex });
      }
      column += span;
    }
  }
  return [...byColumn.entries()]
    .sort(([left], [right]) => left - right)
    .map(([, item]) => item.field)
    .filter((field, index, values) => values.indexOf(field) === index);
}

function sameOrder<T extends string>(left: readonly T[], right: readonly T[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function includesAll<T extends string>(values: readonly T[], required: readonly T[]) {
  return required.every((value) => values.includes(value));
}

function confidenceScore(input: {
  identificationFound: boolean;
  scheduleFields: PlanTemplateScheduleField[];
  evaluationFields: PlanTemplateEvaluationField[];
  scheduleColumns: number;
  evaluationColumns: number;
}) {
  let score = input.identificationFound ? 20 : 0;
  const scheduleCore: PlanTemplateScheduleField[] = ["WEEK", "CONTENTS", "ACTIVITIES", "RESOURCES"];
  const evaluationCore: PlanTemplateEvaluationField[] = ["COMPONENT", "ACTIVITY", "INSTRUMENT", "WEEK", "GRADE", "WEIGHT"];
  score += Math.round((scheduleCore.filter((field) => input.scheduleFields.includes(field)).length / scheduleCore.length) * 35);
  score += Math.round((evaluationCore.filter((field) => input.evaluationFields.includes(field)).length / evaluationCore.length) * 35);
  if (input.scheduleFields.length === input.scheduleColumns) score += 5;
  if (input.evaluationFields.length === input.evaluationColumns) score += 5;
  return Math.max(0, Math.min(100, score));
}

export async function inspectPlanTemplateProfile(bytes: Uint8Array): Promise<PlanTemplateProfile> {
  const zip = await JSZip.loadAsync(bytes);
  const documentXml = await zip.file("word/document.xml")?.async("string");
  if (!documentXml) throw new Error("El formato del Plan Docente no contiene word/document.xml.");
  const tables = [...documentXml.matchAll(/<w:tbl\b[\s\S]*?<\/w:tbl>/gu)].map((match) => match[0]);

  const identification = tables.find((table) => {
    const text = normalizeSemanticText(tableText(table));
    return /\bfacultad\b/u.test(text) && /\bcarrera\b/u.test(text) && /\basignatura\b/u.test(text) && /numero\s+de\s+creditos/u.test(text);
  });

  const schedule = tables.find((table) => {
    const text = normalizeSemanticText(tableText(table));
    const fields = fieldInText(text, scheduleDetectors);
    return includesAll(fields, ["WEEK", "CONTENTS", "ACTIVITIES", "RESOURCES"]);
  });

  const evaluation = tables.find((table) => {
    const text = normalizeSemanticText(tableText(table));
    const fields = fieldInText(text, evaluationDetectors);
    return includesAll(fields, ["COMPONENT", "ACTIVITY", "INSTRUMENT", "WEEK", "GRADE", "WEIGHT"]);
  });

  const identificationText = identification ? normalizeSemanticText(tableText(identification)) : "";
  const scheduleText = schedule ? normalizeSemanticText(tableText(schedule)) : "";
  const evaluationText = evaluation ? normalizeSemanticText(tableText(evaluation)) : "";
  const scheduleColumns = schedule ? tableColumns(schedule) : 0;
  const evaluationColumns = evaluation ? tableColumns(evaluation) : 0;
  const scheduleFields = schedule ? tableFieldLayout(schedule, scheduleDetectors, scheduleColumns) : [];
  const evaluationFields = evaluation ? tableFieldLayout(evaluation, evaluationDetectors, evaluationColumns) : [];
  const warnings: string[] = [];

  if (schedule && scheduleFields.length !== scheduleColumns) {
    warnings.push(`La tabla de programación tiene ${scheduleColumns} columnas y ${scheduleFields.length} columnas semánticas reconocidas.`);
  }
  if (evaluation && evaluationFields.length !== evaluationColumns) {
    warnings.push(`La tabla de evaluación tiene ${evaluationColumns} columnas y ${evaluationFields.length} columnas semánticas reconocidas.`);
  }

  const profile: PlanTemplateProfile = {
    identificationColumns: identification ? tableColumns(identification) : 0,
    identificationIncludesTotalHours: /\btotal horas\b|\bhoras totales\b/u.test(identificationText),
    scheduleColumns,
    scheduleIncludesInstrument: scheduleFields.includes("ASSESSMENT_INSTRUMENT") || /instrumentos?\s+de\s+evaluacion/u.test(scheduleText),
    scheduleIncludesGrade: scheduleFields.includes("GRADE") || /\b(?:calificacion|clificacion)\b/u.test(scheduleText),
    scheduleFields,
    evaluationColumns,
    evaluationIncludesWorkStrategies: evaluationFields.includes("WORK_STRATEGIES") || /estrategias?\s+de\s+trabajo/u.test(evaluationText),
    evaluationIncludesDeliverable: evaluationFields.includes("DELIVERABLE") || /\b(?:entregable|estregable)\b/u.test(evaluationText),
    evaluationFields,
    confidence: confidenceScore({
      identificationFound: Boolean(identification), scheduleFields, evaluationFields, scheduleColumns, evaluationColumns,
    }),
    warnings,
    profile: "UNKNOWN",
  };

  const current = profile.identificationColumns === 4
    && profile.scheduleColumns === 7
    && sameOrder(profile.scheduleFields ?? [], currentScheduleOrder)
    && profile.evaluationColumns === 7
    && sameOrder(profile.evaluationFields ?? [], currentEvaluationOrder);

  const legacy = profile.scheduleColumns === 9
    && sameOrder(profile.scheduleFields ?? [], legacyScheduleOrder)
    && profile.evaluationColumns === 6
    && sameOrder(profile.evaluationFields ?? [], legacyEvaluationOrder);

  const dynamic = Boolean(identification)
    && includesAll(profile.scheduleFields ?? [], ["WEEK", "CONTENTS", "ACTIVITIES", "RESOURCES"])
    && includesAll(profile.evaluationFields ?? [], ["COMPONENT", "ACTIVITY", "INSTRUMENT", "WEEK", "GRADE", "WEIGHT"])
    && (profile.evaluationIncludesWorkStrategies || profile.evaluationIncludesDeliverable)
    && (profile.scheduleFields?.length ?? 0) === profile.scheduleColumns
    && (profile.evaluationFields?.length ?? 0) === profile.evaluationColumns;

  if (current) profile.profile = "CURRENT_MODULAR";
  else if (legacy) profile.profile = "LEGACY_MODULAR";
  else if (dynamic) profile.profile = "DYNAMIC_MODULAR";

  if (!identificationText) profile.identificationColumns = 0;
  if (profile.profile === "UNKNOWN" && !(profile.warnings?.length)) {
    profile.warnings?.push("No se pudo construir un mapeo semántico completo y seguro del formato institucional.");
  }
  return profile;
}
