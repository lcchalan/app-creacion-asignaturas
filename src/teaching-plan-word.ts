import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  HeadingLevel,
  ImageRun,
  PageNumber,
  PageOrientation,
  Packer,
  Paragraph,
  SectionType,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
  type ISectionOptions,
} from "docx";
import type {
  OutcomeMapping,
  PlanCategory,
  TeacherProfile,
  TeachingPlanContent,
} from "./academic/teaching-plan-policy.js";
import JSZip from "jszip";
import type { PlanTemplateProfile } from "./academic/plan-template-profile.js";

const BLUE = "004B76";
const GOLD = "F9BF00";
const LIGHT_BLUE = "D7E0EB";
const LIGHT_GRAY = "E7E6E6";
const WHITE = "FFFFFF";
const BLACK = "000000";
const A4_PORTRAIT_PAGE_WIDTH = 11906;
const A4_PORTRAIT_PAGE_HEIGHT = 16838;
const PORTRAIT_MARGIN = 900;
const PORTRAIT_WIDTH = A4_PORTRAIT_PAGE_WIDTH - (PORTRAIT_MARGIN * 2);
const A4_LANDSCAPE_PAGE_WIDTH = 16838;
const LANDSCAPE_MARGIN = 720;
const LANDSCAPE_WIDTH = A4_LANDSCAPE_PAGE_WIDTH - (LANDSCAPE_MARGIN * 2);

export type TeachingPlanWordInput = {
  project: {
    faculty: string;
    career: string;
    level?: string;
    subjectName: string;
    subjectCode: string;
    modality: string;
    academicPeriod: string;
    professorName: string;
    totalWeeks: number;
  };
  period?: {
    startsAt?: string | null;
    bimestralEvaluationStartAt?: string | null;
    bimestralEvaluationEndAt?: string | null;
    recoveryEvaluationStartAt?: string | null;
    recoveryEvaluationEndAt?: string | null;
  };
  templateProfile?: PlanTemplateProfile;
  offering: {
    credits: number | null;
    acdHours: number;
    apeHours: number;
    aaHours: number;
    semester: string | null;
    prerequisites: string[];
    unitContents: string[];
    planCategory: PlanCategory;
  };
  mappings: OutcomeMapping[];
  teacher: TeacherProfile & { name: string; email: string };
  bibliography: { guideReference: string; guideReferenceImportance: string; basic: string; complementary: string; rea: string };
  plan: TeachingPlanContent;
  logo?: { data: Uint8Array; type: "png" | "jpg" | "gif" | "bmp" };
};

export async function extractTemplateLogo(documentBytes: Buffer): Promise<TeachingPlanWordInput["logo"]> {
  const archive = await JSZip.loadAsync(documentBytes);
  const entry = Object.values(archive.files).find((file) =>
    !file.dir && /^word\/media\/[^/]+\.(png|jpe?g|gif|bmp)$/i.test(file.name));
  if (!entry) return undefined;
  const extension = entry.name.split(".").at(-1)?.toLowerCase();
  const type = extension === "jpeg" ? "jpg" : extension;
  if (!type || !["png", "jpg", "gif", "bmp"].includes(type)) return undefined;
  return {
    data: await entry.async("uint8array"),
    type: type as "png" | "jpg" | "gif" | "bmp",
  };
}

function textParagraph(value = "", options: {
  bold?: boolean;
  size?: number;
  color?: string;
  alignment?: typeof AlignmentType[keyof typeof AlignmentType];
  before?: number;
  after?: number;
} = {}) {
  return new Paragraph({
    alignment: options.alignment,
    spacing: { before: options.before ?? 0, after: options.after ?? 80, line: 276 },
    children: [new TextRun({
      text: value,
      bold: options.bold,
      size: options.size ?? 20,
      color: options.color ?? BLACK,
      font: "Arial",
    })],
  });
}

function lines(value: string) {
  return value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
}

function listParagraphs(values: string[]) {
  return values.length
    ? values.map((value) => new Paragraph({
        bullet: { level: 0 },
        spacing: { after: 60, line: 276 },
        children: [new TextRun({ text: value, size: 20, font: "Arial" })],
      }))
    : [textParagraph("No aplica")];
}

function tableCell(content: string | Paragraph[], options: {
  width: number;
  bold?: boolean;
  size?: number;
  fill?: string;
  alignment?: typeof AlignmentType[keyof typeof AlignmentType];
  columnSpan?: number;
}): TableCell {
  const children = typeof content === "string"
    ? [textParagraph(content, {
        bold: options.bold,
        size: options.size,
        alignment: options.alignment,
        after: 0,
      })]
    : content;
  return new TableCell({
    width: { size: options.width, type: WidthType.DXA },
    columnSpan: options.columnSpan,
    verticalAlign: VerticalAlign.CENTER,
    shading: options.fill ? { fill: options.fill, type: ShadingType.CLEAR, color: "auto" } : undefined,
    margins: { top: 100, right: 120, bottom: 100, left: 120 },
    children,
  });
}

function fixedTable(width: number, columnWidths: number[], rows: TableRow[]) {
  return new Table({
    width: { size: width, type: WidthType.DXA },
    columnWidths,
    layout: TableLayoutType.FIXED,
    rows,
  });
}

function scaledColumnWidths(baseWidths: number[], totalWidth: number) {
  const baseTotal = baseWidths.reduce((sum, width) => sum + width, 0);
  let used = 0;
  return baseWidths.map((width, index) => {
    if (index === baseWidths.length - 1) return totalWidth - used;
    const scaled = Math.round((width / baseTotal) * totalWidth);
    used += scaled;
    return scaled;
  });
}

function separatedParagraphs(values: string[], options: { size?: number; bold?: boolean; emptyText?: string } = {}) {
  const cleaned = values.map((value) => value.trim()).filter(Boolean);
  const source = cleaned.length ? cleaned : [options.emptyText ?? "—"];
  return source.map((value, index) => textParagraph(value, {
    size: options.size,
    bold: options.bold,
    after: index === source.length - 1 ? 0 : 100,
  }));
}

function boxedDescriptionField(title: string, values: string[]) {
  const body = values.map((value) => value.trim()).filter(Boolean);
  return fixedTable(PORTRAIT_WIDTH, [PORTRAIT_WIDTH], [new TableRow({
    cantSplit: true,
    children: [tableCell([
      textParagraph(title, { bold: true, after: 60 }),
      ...separatedParagraphs(body.length ? body : ["No aplica"]),
    ], { width: PORTRAIT_WIDTH })],
  })]);
}

function sectionBand(title: string, width = PORTRAIT_WIDTH) {
  return fixedTable(width, [width], [new TableRow({
    children: [tableCell(title, { width, bold: true, fill: LIGHT_GRAY })],
  })]);
}

function pageFooter() {
  return new Footer({
    children: [new Paragraph({
      alignment: AlignmentType.RIGHT,
      children: [new TextRun({ children: [PageNumber.CURRENT], size: 18, font: "Arial" })],
    })],
  });
}

function portraitSection(children: Array<Paragraph | Table>, options: Partial<ISectionOptions> = {}): ISectionOptions {
  return {
    ...options,
    properties: {
      type: options.properties?.type,
      page: {
        size: {
          orientation: PageOrientation.PORTRAIT,
          width: A4_PORTRAIT_PAGE_WIDTH,
          height: A4_PORTRAIT_PAGE_HEIGHT,
        },
        margin: { top: PORTRAIT_MARGIN, right: PORTRAIT_MARGIN, bottom: PORTRAIT_MARGIN, left: PORTRAIT_MARGIN },
      },
    },
    footers: { default: pageFooter() },
    children,
  };
}

function categoryLabel(category: PlanCategory) {
  if (category === "CONCEPTUAL") return "Conceptual";
  if (category === "ACTIVE") return "Activa";
  return "Integradora";
}

function categorySelectionLabel(category: PlanCategory) {
  return `Conceptual ${category === "CONCEPTUAL" ? "☒" : "☐"}   Activa ${category === "ACTIVE" ? "☒" : "☐"}   Integradora ${category === "INTEGRATING" ? "☒" : "☐"}`;
}

function identificationTable(input: TeachingPlanWordInput) {
  const totalHours = input.offering.acdHours + input.offering.apeHours + input.offering.aaHours;
  if (input.templateProfile?.profile === "CURRENT_MODULAR") {
    const widths = scaledColumnWidths([2200, 2380, 2380, 2400], PORTRAIT_WIDTH);
    const mergedValue = (label: string, value: string) => new TableRow({ children: [
      tableCell(label, { width: widths[0]!, bold: true }),
      tableCell(value, { width: PORTRAIT_WIDTH - widths[0]!, columnSpan: 3 }),
    ] });
    return fixedTable(PORTRAIT_WIDTH, widths, [
      mergedValue("Facultad", input.project.faculty),
      mergedValue("Carrera", input.project.career),
      mergedValue("Asignatura", input.project.subjectName),
      mergedValue("Código", input.project.subjectCode),
      mergedValue("Número de créditos", String(input.offering.credits ?? "—")),
      new TableRow({ children: [
        tableCell("Total de horas por componente de aprendizaje", { width: widths[0]!, bold: true }),
        tableCell("Aprendizaje en contacto con el docente (ACD)", { width: widths[1]!, bold: true, alignment: AlignmentType.CENTER }),
        tableCell("Aprendizaje Práctico-Experimental (APE)", { width: widths[2]!, bold: true, alignment: AlignmentType.CENTER }),
        tableCell("Aprendizaje Autónomo (AA)", { width: widths[3]!, bold: true, alignment: AlignmentType.CENTER }),
      ] }),
      new TableRow({ children: [
        tableCell(`Total: ${totalHours}`, { width: widths[0]!, bold: true }),
        tableCell(String(input.offering.acdHours), { width: widths[1]!, alignment: AlignmentType.CENTER }),
        tableCell(String(input.offering.apeHours), { width: widths[2]!, alignment: AlignmentType.CENTER }),
        tableCell(String(input.offering.aaHours), { width: widths[3]!, alignment: AlignmentType.CENTER }),
      ] }),
      mergedValue("Tipo de asignatura", categorySelectionLabel(input.offering.planCategory)),
      mergedValue("Periodo académico/nivel", `${input.project.academicPeriod} / ${input.project.level || "—"}`),
      mergedValue("Período académico ordinario/semestre", input.offering.semester ?? "—"),
    ]);
  }
  const widths = scaledColumnWidths([2400, 2280, 2400, 2280], PORTRAIT_WIDTH);
  return fixedTable(PORTRAIT_WIDTH, widths, [
    new TableRow({ children: [tableCell("PERÍODO ACADÉMICO ORDINARIO", {
      width: PORTRAIT_WIDTH, bold: true, fill: LIGHT_GRAY, alignment: AlignmentType.CENTER, columnSpan: 4,
    })] }),
    new TableRow({ children: [
      tableCell("Facultad", { width: widths[0]!, bold: true }), tableCell(input.project.faculty, { width: widths[1]! }),
      tableCell("Carrera", { width: widths[2]!, bold: true }), tableCell(input.project.career, { width: widths[3]! }),
    ] }),
    new TableRow({ children: [
      tableCell("Asignatura", { width: widths[0]!, bold: true }), tableCell(input.project.subjectName, { width: widths[1]! }),
      tableCell("Código", { width: widths[2]!, bold: true }), tableCell(input.project.subjectCode, { width: widths[3]! }),
    ] }),
    new TableRow({ children: [
      tableCell("Número de créditos/horas", { width: widths[0]!, bold: true }),
      tableCell(`Créditos: ${input.offering.credits ?? "—"} · Horas totales: ${totalHours}`, { width: PORTRAIT_WIDTH - widths[0]!, columnSpan: 3 }),
    ] }),
    new TableRow({ children: [
      tableCell("Total de horas por componente de aprendizaje", { width: widths[0]!, bold: true }),
      tableCell(`ACD\n${input.offering.acdHours}`, { width: widths[1]!, bold: true, alignment: AlignmentType.CENTER }),
      tableCell(`APE\n${input.offering.apeHours}`, { width: widths[2]!, bold: true, alignment: AlignmentType.CENTER }),
      tableCell(`AA\n${input.offering.aaHours}`, { width: widths[3]!, bold: true, alignment: AlignmentType.CENTER }),
    ] }),
    new TableRow({ children: [
      tableCell("Tipo de asignatura", { width: widths[0]!, bold: true }), tableCell(categorySelectionLabel(input.offering.planCategory), { width: widths[1]! }),
      tableCell("Duración", { width: widths[2]!, bold: true }), tableCell(`${input.project.totalWeeks} semanas lectivas`, { width: widths[3]! }),
    ] }),
    new TableRow({ children: [
      tableCell("Periodo académico/nivel", { width: widths[0]!, bold: true }), tableCell(input.project.academicPeriod, { width: widths[1]! }),
      tableCell("Período académico ordinario/semestre", { width: widths[2]!, bold: true }), tableCell(input.offering.semester ?? "—", { width: widths[3]! }),
    ] }),
  ]);
}

function contributionTable(input: TeachingPlanWordInput) {
  const widths = scaledColumnWidths([2200, 1200, 2100, 2100, 1760], PORTRAIT_WIDTH);
  const contribution: Record<OutcomeMapping["contribution"], string> = {
    INITIAL: "Inicial",
    MIDDLE: "Medio",
    FINAL: "Final",
  };
  return fixedTable(PORTRAIT_WIDTH, widths, [
    new TableRow({ tableHeader: true, children: [
      "Resultados de aprendizaje de la asignatura",
      "Contribución",
      "Competencia(s) del perfil profesional",
      "Resultados de aprendizaje del perfil de egreso",
      "Competencia(s) genérica(s) UTPL",
    ].map((label, index) => tableCell(label, { width: widths[index] ?? 1000, bold: true, fill: LIGHT_GRAY })) }),
    ...input.mappings.map((mapping) => new TableRow({ children: [
      tableCell(mapping.learningOutcome, { width: widths[0] ?? 2200 }),
      tableCell(contribution[mapping.contribution], { width: widths[1] ?? 1200, alignment: AlignmentType.CENTER }),
      tableCell(mapping.professionalCompetencies.join("\n"), { width: widths[2] ?? 2100 }),
      tableCell(mapping.graduateProfileResults.join("\n"), { width: widths[3] ?? 2100 }),
      tableCell(mapping.utplGenericCompetencies.join("\n") || "No aplica", { width: widths[4] ?? 1760 }),
    ] })),
  ]);
}

function normalizedContentKey(value: string) {
  return value.normalize("NFKC").trim().replace(/\s+/gu, " ").toLocaleLowerCase("es");
}

function contentDepth(value: string) {
  const raw = value.trim();
  if (/^UNIDAD\s*:/iu.test(raw) || /^UNIDAD\s+\d+/iu.test(raw)) return 1;
  if (/^CONTENIDO\s*:/iu.test(raw)) return 2;
  if (/^SUBCONTENIDO\s*:/iu.test(raw)) return 3;
  const number = raw.match(/^\s*(\d+(?:\.\d+){0,2})\s*(?:[.)]|[:\-–—])/u)?.[1];
  return number ? number.split(".").length : 1;
}

function contentText(value: string) {
  return value
    .replace(/^\s*(?:UNIDAD|CONTENIDO|SUBCONTENIDO)\s*:\s*/iu, "")
    .replace(/^\s*UNIDAD\s+\d+(?:\.\d+)*\s*(?:[.)]|[:\-–—])?\s*/iu, "")
    .replace(/^\s*\d+(?:\.\d+){0,3}\s*(?:[.)]|[:\-–—])\s*/u, "")
    .trim();
}

function sentenceCaseInstitutionalUnit(value: string) {
  const trimmed = value.trim();
  if (!trimmed || trimmed !== trimmed.toLocaleUpperCase("es")) return trimmed;
  const acronyms = new Set(["UTPL", "EVA", "IA", "TIC", "TICs", "ACD", "APE", "AA", "REA", "APA", "CACES"]);
  const lower = trimmed.toLocaleLowerCase("es").replace(/(^|\s)([a-záéíóúüñ])/u, (match, prefix, letter, offset) => offset === 0 ? `${prefix}${String(letter).toLocaleUpperCase("es")}` : match);
  return lower.split(/(\s+)/).map((token) => {
    const plain = token.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/g, "").toLocaleUpperCase("es");
    const acronym = [...acronyms].find((item) => item.toLocaleUpperCase("es") === plain);
    return acronym ? token.replace(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+/u, acronym) : token;
  }).join("");
}

function numberedContentMap(values: string[]) {
  const result = new Map<string, string>();
  let unit = 0;
  let content = 0;
  let subcontent = 0;
  for (const raw of values) {
    const depth = contentDepth(raw);
    const rawText = contentText(raw);
    const text = depth === 1 ? sentenceCaseInstitutionalUnit(rawText) : rawText;
    if (depth === 1) { unit += 1; content = 0; subcontent = 0; }
    else if (depth === 2) { if (!unit) unit = 1; content += 1; subcontent = 0; }
    else { if (!unit) unit = 1; if (!content) content = 1; subcontent += 1; }
    result.set(normalizedContentKey(raw), depth === 1 ? `Unidad ${unit}: ${text}` : depth === 2 ? `${unit}.${content}. ${text}` : `${unit}.${content}.${subcontent}. ${text}`);
  }
  return result;
}

function weekActivityLines(week: TeachingPlanContent["sequences"][number]["weeks"][number]) {
  if (week.activityDetails.length) {
    return week.activityDetails.map((detail) => `[${detail.component}] ${detail.evaluationCode ? `[${detail.evaluationCode}] ` : ""}${detail.description}`);
  }
  return week.activities;
}

function scheduleTables(input: TeachingPlanWordInput) {
  const children: Array<Paragraph | Table> = [
    sectionBand("D. Programación del proceso de aprendizaje de la asignatura", LANDSCAPE_WIDTH),
    textParagraph("1. Descripción de la secuencia didáctica", { bold: true, size: 22, before: 180, after: 100 }),
  ];
  const currentFormat = input.templateProfile?.profile === "CURRENT_MODULAR";
  const widths = scaledColumnWidths(
    currentFormat
      ? [850, 2800, 650, 650, 650, 4000, 3360]
      : [800, 2450, 550, 550, 550, 3000, 1900, 1900, 1260],
    LANDSCAPE_WIDTH,
  );
  const headers = currentFormat
    ? ["Semana", "Contenidos", "ACD", "APE", "AA", "Actividades de aprendizaje", "Recursos de aprendizaje"]
    : ["Semana", "Contenidos", "ACD", "APE", "AA", "Actividades de aprendizaje", "Recursos de aprendizaje", "Instrumentos de evaluación", "Calificación"];
  const contentLabels = numberedContentMap(input.offering.unitContents);
  for (const sequence of input.plan.sequences) {
    children.push(fixedTable(LANDSCAPE_WIDTH, [LANDSCAPE_WIDTH], [new TableRow({ children: [
      tableCell(`Resultado de aprendizaje de la asignatura: ${sequence.learningOutcome}`, {
        width: LANDSCAPE_WIDTH, bold: true, fill: LIGHT_GRAY,
      }),
    ] })]));
    const sequenceInfoWidths = scaledColumnWidths([1, 1], LANDSCAPE_WIDTH);
    children.push(fixedTable(LANDSCAPE_WIDTH, sequenceInfoWidths, [new TableRow({ children: [
      tableCell([
        textParagraph("Metodología(s) activa(s)", { bold: true, after: 60 }),
        ...separatedParagraphs(lines(sequence.methodology)),
      ], { width: sequenceInfoWidths[0]!, fill: LIGHT_GRAY }),
      tableCell([
        textParagraph("Tecnologías del aprendizaje y conocimiento - TAC", { bold: true, after: 60 }),
        ...separatedParagraphs(sequence.tac),
      ], { width: sequenceInfoWidths[1]!, fill: LIGHT_GRAY }),
    ] })]));
    children.push(fixedTable(LANDSCAPE_WIDTH, widths, [
      new TableRow({ tableHeader: true, children: headers.map((label, index) => tableCell(label, {
        width: widths[index] ?? 1000, bold: true, size: 16, fill: LIGHT_GRAY, alignment: AlignmentType.CENTER,
      })) }),
      ...sequence.weeks.map((week) => {
        const base = [
          tableCell(String(week.week), { width: widths[0] ?? 800, alignment: AlignmentType.CENTER }),
          tableCell(separatedParagraphs(week.unitContents.map((value) => contentLabels.get(normalizedContentKey(value)) ?? value)), { width: widths[1] ?? 2450 }),
          tableCell(String(week.acdHours), { width: widths[2] ?? 550, alignment: AlignmentType.CENTER }),
          tableCell(String(week.apeHours), { width: widths[3] ?? 550, alignment: AlignmentType.CENTER }),
          tableCell(String(week.aaHours), { width: widths[4] ?? 550, alignment: AlignmentType.CENTER }),
          tableCell(separatedParagraphs(weekActivityLines(week)), { width: widths[5] ?? 3000 }),
          tableCell(separatedParagraphs(week.resources), { width: widths[6] ?? 1900 }),
        ];
        if (!currentFormat) {
          base.push(tableCell(week.assessmentInstrument, { width: widths[7] ?? 1900 }));
          base.push(tableCell(week.grade ? week.grade.toFixed(1) : "—", { width: widths[8] ?? 1260, alignment: AlignmentType.CENTER }));
        }
        return new TableRow({ children: base });
      }),
    ]));
    children.push(textParagraph("", { after: 120 }));
  }
  return children;
}

function formatDateEc(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("es-EC", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(date);
}

function weekDateRange(startsAt: string | null | undefined, weekNumber: number) {
  if (!startsAt) return "";
  const start = new Date(startsAt);
  if (Number.isNaN(start.getTime())) return "";
  const day = start.getUTCDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  start.setUTCDate(start.getUTCDate() + mondayOffset + ((weekNumber - 1) * 7));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  return `${formatDateEc(start.toISOString())} al ${formatDateEc(end.toISOString())}`;
}

function evaluationWindow(start?: string | null, end?: string | null) {
  const from = formatDateEc(start);
  const to = formatDateEc(end);
  if (!from && !to) return "No configurado";
  if (from && to && from !== to) return `${from} al ${to}`;
  return from || to;
}

function recoveryEvaluationTable(input: TeachingPlanWordInput, totalWidth: number) {
  const widths = scaledColumnWidths([4300, 1220, 1940], totalWidth);
  const recoveryWindow = evaluationWindow(input.period?.recoveryEvaluationStartAt, input.period?.recoveryEvaluationEndAt);
  return fixedTable(totalWidth, widths, [
    new TableRow({
      tableHeader: true,
      children: [
        tableCell("Actividades académicas", { width: widths[0]!, bold: true, alignment: AlignmentType.CENTER }),
        tableCell("Puntaje", { width: widths[1]!, bold: true, alignment: AlignmentType.CENTER }),
        tableCell("Semana", { width: widths[2]!, bold: true, alignment: AlignmentType.CENTER }),
      ],
    }),
    new TableRow({
      children: [
        tableCell([
          textParagraph("Evaluación de recuperación", { after: 60 }),
          textParagraph("(Recuperación 70%, más acumulado de la sumatoria de actividades ACD, AA y APE, ponderado al 30%)", { after: 0 }),
        ], { width: widths[0]! }),
        tableCell("10", { width: widths[1]!, alignment: AlignmentType.CENTER }),
        tableCell([
          textParagraph("Semana 10", { bold: true, alignment: AlignmentType.CENTER, after: recoveryWindow !== "No configurado" ? 60 : 0 }),
          ...(recoveryWindow !== "No configurado"
            ? [textParagraph(recoveryWindow, { alignment: AlignmentType.CENTER, after: 0 })]
            : []),
        ], { width: widths[2]! }),
      ],
    }),
  ]);
}

function evaluationTable(input: TeachingPlanWordInput, totalWidth = PORTRAIT_WIDTH) {
  const currentFormat = input.templateProfile?.profile === "CURRENT_MODULAR";
  const widths = scaledColumnWidths(
    currentFormat ? [850, 1900, 2000, 1400, 1300, 950, 960] : [1100, 3200, 1550, 1500, 1010, 1000],
    totalWidth,
  );
  const sorted = [...input.plan.evaluatedActivities].sort((a, b) => a.week - b.week);
  const headerLabels = currentFormat
    ? ["Componente", "Actividad", "Estrategias de trabajo", "Instrumento de evaluación", "Semana ejecución*", "Calificación", "Peso"]
    : ["Componente", "Actividad", "Instrumento de evaluación", "Semana ejecución*", "Calificación", "Peso"];
  return fixedTable(totalWidth, widths, [
    new TableRow({ tableHeader: true, children: headerLabels.map((label, index) => tableCell(label, { width: widths[index] ?? 1000, bold: true, fill: LIGHT_GRAY, alignment: AlignmentType.CENTER })) }),
    ...sorted.map((activity) => {
      const date = weekDateRange(input.period?.startsAt, activity.week);
      if (currentFormat) return new TableRow({ children: [
        tableCell(activity.component, { width: widths[0] ?? 1000, bold: true, alignment: AlignmentType.CENTER }),
        tableCell(`${activity.code}. ${activity.activity}`, { width: widths[1] ?? 2500 }),
        tableCell(String(activity.workStrategies || "").split(/\r?\n|[•·]\s*/u).map((item) => item.trim()).filter(Boolean).map((item) => `• ${item}`).join("\n"), { width: widths[2] ?? 2600 }),
        tableCell(activity.instrument, { width: widths[3] ?? 1700 }),
        tableCell(`Semana ${activity.week}${date ? `\n${date}` : ""}`, { width: widths[4] ?? 1500, alignment: AlignmentType.CENTER }),
        tableCell(activity.grade.toFixed(1), { width: widths[5] ?? 900, alignment: AlignmentType.CENTER }),
        tableCell(`${activity.weight}%`, { width: widths[6] ?? 900, alignment: AlignmentType.CENTER }),
      ] });
      return new TableRow({ children: [
        tableCell(activity.component, { width: widths[0] ?? 1100, bold: true, alignment: AlignmentType.CENTER }),
        tableCell(`${activity.code}. ${activity.activity}\n\nEstrategias de trabajo:\n${String(activity.workStrategies || "").split(/\r?\n|[•·]\s*/u).map((item) => item.trim()).filter(Boolean).map((item) => `• ${item}`).join("\n")}`, { width: widths[1] ?? 3200 }),
        tableCell(activity.instrument, { width: widths[2] ?? 1550 }),
        tableCell(`Semana ${activity.week}${date ? `\n${date}` : ""}`, { width: widths[3] ?? 1500, alignment: AlignmentType.CENTER }),
        tableCell(activity.grade.toFixed(1), { width: widths[4] ?? 1010, alignment: AlignmentType.CENTER }),
        tableCell(`${activity.weight}%`, { width: widths[5] ?? 1000, alignment: AlignmentType.CENTER }),
      ] });
    }),
    new TableRow({ children: currentFormat ? [
      tableCell("TOTAL", { width: widths[0]!, bold: true, columnSpan: 5, alignment: AlignmentType.RIGHT }),
      tableCell(sorted.reduce((sum, item) => sum + item.grade, 0).toFixed(1), { width: widths[5]!, bold: true, alignment: AlignmentType.CENTER }),
      tableCell(`${sorted.reduce((sum, item) => sum + item.weight, 0)}%`, { width: widths[6]!, bold: true, alignment: AlignmentType.CENTER }),
    ] : [
      tableCell("TOTAL", { width: widths[0]!, bold: true, columnSpan: 4, alignment: AlignmentType.RIGHT }),
      tableCell(sorted.reduce((sum, item) => sum + item.grade, 0).toFixed(1), { width: widths[4]!, bold: true, alignment: AlignmentType.CENTER }),
      tableCell(`${sorted.reduce((sum, item) => sum + item.weight, 0)}%`, { width: widths[5]!, bold: true, alignment: AlignmentType.CENTER }),
    ] }),
  ]);
}

function instrumentTypeLabel(type: string) {
  if (type === "QUESTIONNAIRE") return "Cuestionario";
  if (type === "RUBRIC") return "Rúbrica";
  if (type === "CHECKLIST") return "Lista de cotejo";
  if (type === "RATING_SCALE") return "Escala de valoración";
  return "Instrumento";
}

function questionnaireModeLabel(mode?: string | null) {
  if (mode === "LAST_ATTEMPT") return "Último intento";
  if (mode === "HIGHEST_GRADE") return "Calificación más alta";
  return "—";
}

function instrumentConfigurationChildren(input: TeachingPlanWordInput) {
  const children: Array<Paragraph | Table> = [];
  for (const activity of [...input.plan.evaluatedActivities].sort((a, b) => a.week - b.week)) {
    const config = activity.instrumentConfig;
    if (!config) continue;
    children.push(textParagraph(`${activity.code}. ${instrumentTypeLabel(config.type)} — configuración EVA sobre 10 puntos`, {
      bold: true, size: 20, before: 180, after: 80,
    }));
    children.push(textParagraph(`Actividad: ${activity.activity}`, { after: 60 }));
    children.push(textParagraph(`Conversión a la calificación real: (puntaje EVA / 10) × ${activity.grade.toFixed(2)} puntos.`, { after: 80 }));
    if (config.type === "QUESTIONNAIRE") {
      children.push(fixedTable(PORTRAIT_WIDTH, [3000, PORTRAIT_WIDTH - 3000], [
        new TableRow({ children: [tableCell("Tipo de calificación", { width: 3000, bold: true }), tableCell(questionnaireModeLabel(config.questionnaire?.gradingMode), { width: PORTRAIT_WIDTH - 3000 })] }),
        new TableRow({ children: [tableCell("Número de preguntas", { width: 3000, bold: true }), tableCell(String(config.questionnaire?.questionCount ?? "—"), { width: PORTRAIT_WIDTH - 3000 })] }),
        new TableRow({ children: [tableCell("Tiempo", { width: 3000, bold: true }), tableCell(config.questionnaire?.timeMinutes ? `${config.questionnaire.timeMinutes} minutos` : "—", { width: PORTRAIT_WIDTH - 3000 })] }),
      ]));
      continue;
    }
    if (!["RUBRIC", "CHECKLIST", "RATING_SCALE"].includes(config.type) || !config.criteria.length) continue;
    const levelLabels = [...new Set(config.criteria.flatMap((criterion) => criterion.levels.map((level) => level.label)))];
    const firstWidth = 2600;
    const levelWidth = Math.floor((PORTRAIT_WIDTH - firstWidth) / Math.max(levelLabels.length, 1));
    const widths = [firstWidth, ...levelLabels.map(() => levelWidth)];
    children.push(fixedTable(PORTRAIT_WIDTH, widths, [
      new TableRow({ tableHeader: true, children: ["Indicadores", ...levelLabels].map((label, index) => tableCell(label, {
        width: widths[index] ?? levelWidth, bold: true, fill: LIGHT_BLUE, alignment: AlignmentType.CENTER,
      })) }),
      ...config.criteria.map((criterion) => new TableRow({ children: [
        tableCell(criterion.label, { width: firstWidth, bold: true }),
        ...levelLabels.map((label, index) => {
          const level = criterion.levels.find((item) => item.label === label);
          return tableCell(level ? `${level.description}${level.description ? "\n" : ""}${level.score.toFixed(2)} pts` : "—", {
            width: widths[index + 1] ?? levelWidth,
          });
        }),
      ] })),
    ]));
    const max = config.criteria.reduce((sum, criterion) => sum + Math.max(...criterion.levels.map((level) => level.score)), 0);
    children.push(textParagraph(`Puntaje máximo del instrumento: ${max.toFixed(2)} / 10.`, { bold: true, alignment: AlignmentType.RIGHT, after: 80 }));
  }
  return children;
}

function teacherTable(input: TeachingPlanWordInput) {
  const labelWidth = 2600;
  const valueWidth = PORTRAIT_WIDTH - labelWidth;
  const items = [
    ["Nombre", input.teacher.name],
    ["Título(s) de tercer nivel", input.teacher.thirdLevelDegrees.join("\n")],
    ["Título(s) de cuarto nivel", input.teacher.fourthLevelDegrees.join("\n") || "No registrado"],
    ["Facultad", input.teacher.faculty],
    ["Departamento", input.teacher.department],
    ["Correo electrónico", input.teacher.email],
    ["Teléfono", input.teacher.phone],
    ["Currículo profesional resumido", input.teacher.shortCv],
  ];
  return fixedTable(PORTRAIT_WIDTH, [labelWidth, valueWidth], [
    new TableRow({ children: [tableCell("Docente responsable", {
      width: PORTRAIT_WIDTH, bold: true, fill: LIGHT_GRAY, alignment: AlignmentType.CENTER, columnSpan: 2,
    })] }),
    ...items.map(([label, value]) => new TableRow({ cantSplit: true, children: [
      tableCell(label ?? "", { width: labelWidth, bold: true }),
      tableCell(value ?? "", { width: valueWidth }),
    ] })),
  ]);
}

function alphabeticMarker(index: number) {
  let value = Math.max(0, index) + 1;
  let label = "";
  while (value > 0) {
    value -= 1;
    label = String.fromCharCode(97 + (value % 26)) + label;
    value = Math.floor(value / 26);
  }
  return `${label})`;
}

type BibliographyWordEntry = { reference: string; importance: string };

function parseBibliographyWordEntry(value: string): BibliographyWordEntry {
  const normalized = value.trim();
  const marker = /\s+—\s+Importancia para el estudiante:\s*/iu;
  const match = marker.exec(normalized);
  if (!match || match.index < 0) return { reference: normalized, importance: "" };
  return {
    reference: normalized.slice(0, match.index).trim(),
    importance: normalized.slice(match.index + match[0].length).trim(),
  };
}

function bibliographyImportanceParagraph(value: string) {
  return new Paragraph({
    spacing: { before: 60, after: 160, line: 276 },
    indent: { left: 300 },
    children: [
      new TextRun({ text: "Importancia para el estudiante:", bold: true, size: 20, font: "Arial" }),
      new TextRun({ text: ` ${value}`, size: 20, font: "Arial" }),
    ],
  });
}

function alphabeticBibliographyParagraphs(entries: BibliographyWordEntry[]) {
  if (!entries.length) return [textParagraph("No aplica")];
  return entries.flatMap((entry, index) => {
    const reference = textParagraph(`${alphabeticMarker(index)} ${entry.reference}`, { after: entry.importance ? 40 : 160 });
    return entry.importance ? [reference, bibliographyImportanceParagraph(entry.importance)] : [reference];
  });
}

function bibliographyChildren(input: TeachingPlanWordInput) {
  const guideReference = lines(input.bibliography.guideReference).join(" ") || "No aplica";
  const guideImportance = lines(input.bibliography.guideReferenceImportance).join(" ");
  const basic: BibliographyWordEntry[] = [
    { reference: guideReference, importance: guideImportance },
    ...lines(input.bibliography.basic).map(parseBibliographyWordEntry),
  ];
  const complementary = lines(input.bibliography.complementary).map(parseBibliographyWordEntry);
  const rea = lines(input.bibliography.rea).map(parseBibliographyWordEntry);
  return [
    textParagraph("BIBLIOGRAFÍA BÁSICA", { bold: true, size: 22, before: 160 }),
    ...alphabeticBibliographyParagraphs(basic),
    textParagraph("BIBLIOGRAFÍA COMPLEMENTARIA", { bold: true, size: 22, before: 160 }),
    ...alphabeticBibliographyParagraphs(complementary),
    textParagraph("RECURSOS EDUCATIVOS ABIERTOS (REAs)", { bold: true, size: 22, before: 160 }),
    ...alphabeticBibliographyParagraphs(rea),
  ];
}

function coverChildren(input: TeachingPlanWordInput) {
  const children: Paragraph[] = [];
  if (input.logo) {
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 760, after: 980 },
      children: [new ImageRun({
        data: input.logo.data,
        type: input.logo.type,
        transformation: { width: 390, height: 235 },
      })],
    }));
  } else {
    children.push(textParagraph("UTPL", { bold: true, size: 56, color: BLUE, alignment: AlignmentType.CENTER, before: 820, after: 120 }));
    children.push(textParagraph("Vicerrectorado Académico", { bold: true, size: 24, color: BLUE, alignment: AlignmentType.CENTER, after: 980 }));
  }
  // La portada se reparte en bloques verticales claros. Los espaciados son
  // deliberadamente mayores que en las páginas de contenido para evitar que
  // todos los datos queden concentrados en la mitad superior de la hoja.
  children.push(textParagraph("UNIVERSIDAD TÉCNICA PARTICULAR DE LOJA", { bold: true, size: 28, alignment: AlignmentType.CENTER, after: 1300 }));
  children.push(textParagraph(`FACULTAD: ${input.project.faculty}`, { bold: true, size: 24, alignment: AlignmentType.CENTER, after: 420 }));
  children.push(textParagraph(`CARRERA: ${input.project.career}`, { bold: true, size: 24, alignment: AlignmentType.CENTER, after: 1300 }));
  children.push(textParagraph(`PLAN DOCENTE DE LA ASIGNATURA: ${input.project.subjectName}`, { bold: true, size: 24, alignment: AlignmentType.CENTER, after: 420 }));
  children.push(textParagraph(`DOCENTE RESPONSABLE: ${input.project.professorName}`, { bold: true, size: 24, alignment: AlignmentType.CENTER, after: 1080 }));
  children.push(textParagraph(`MODALIDAD DE ESTUDIO: ${input.project.modality.toUpperCase()}`, { size: 24, alignment: AlignmentType.CENTER, after: 1100 }));
  children.push(textParagraph("PERÍODO ACADÉMICO ORDINARIO", { bold: true, size: 24, alignment: AlignmentType.CENTER, after: 220 }));
  children.push(textParagraph(input.project.academicPeriod, { size: 22, alignment: AlignmentType.CENTER, after: 220 }));
  return children;
}

const DEFAULT_CURRICULAR_ADAPTATIONS = "Para garantizar una educación de calidad acorde a las características del modelo educativo de la Universidad Técnica Particular de Loja, al principio de igualdad de oportunidades y a las necesidades educativas especiales asociadas o no a la discapacidad, se desarrollan adaptaciones curriculares no significativas o de grado dos que siguen una trayectoria de menor a mayor significación, considerando el aspecto metodológico, actividades de aprendizaje y el estilo individual de aprendizaje en cuanto a las estrategias a desarrollar. Estas adaptaciones se realizan en función de la identificación de las necesidades educativas en las primeras semanas de trabajo académico, con la finalidad de dar respuesta a la dificultad de aprendizaje y apoyar al desarrollo de las competencias del estudiante.";

export async function buildTeachingPlanWord(input: TeachingPlanWordInput): Promise<Buffer> {
  const approvalWidths = scaledColumnWidths([1800, 3000, 2280, 2280], PORTRAIT_WIDTH);
  const mainPortrait: Array<Paragraph | Table> = [
    sectionBand("A. Datos de identificación de la asignatura"),
    textParagraph("", { after: 100 }),
    identificationTable(input),
    textParagraph("", { after: 160 }),
    sectionBand("B. Descripción de la asignatura"),
    textParagraph("", { after: 70 }),
    boxedDescriptionField("Presentación y contextualización en el marco de la descripción microcurricular", lines(input.plan.presentation)),
    textParagraph("", { after: 70 }),
    boxedDescriptionField("Prerrequisitos", input.offering.prerequisites.length ? input.offering.prerequisites : ["No aplica"]),
    textParagraph("", { after: 70 }),
    boxedDescriptionField("Adaptaciones curriculares", lines(input.plan.curricularAdaptations || DEFAULT_CURRICULAR_ADAPTATIONS)),
    textParagraph("", { after: 180 }),
    sectionBand("C. Contribución al perfil de egreso y profesional y relación con las competencias genéricas de la UTPL"),
    textParagraph("", { after: 100 }),
    contributionTable(input),
    textParagraph("* Las competencias genéricas se incluyen cuando corresponden a la carrera.", { size: 18, after: 100 }),
  ];

  const evaluationLandscape: Array<Paragraph | Table> = [
    sectionBand("E. Evaluación de la asignatura", LANDSCAPE_WIDTH),
    textParagraph(`Asignatura ${categoryLabel(input.offering.planCategory)}`, { bold: true, size: 22, before: 160 }),
    evaluationTable(input, LANDSCAPE_WIDTH),
    textParagraph("Periodos institucionales de evaluación", { bold: true, size: 22, before: 140, after: 60 }),
    textParagraph(`Evaluación bimestral: ${evaluationWindow(input.period?.bimestralEvaluationStartAt, input.period?.bimestralEvaluationEndAt)}.`, { after: 140 }),
    textParagraph("EVALUACIÓN DE RECUPERACIÓN", { bold: true, size: 22, before: 140, after: 80 }),
    recoveryEvaluationTable(input, LANDSCAPE_WIDTH),
  ];

  const finalPortrait: Array<Paragraph | Table> = [
    sectionBand("F. Datos del equipo docente"),
    textParagraph("", { after: 100 }),
    teacherTable(input),
    textParagraph("", { after: 180 }),
    sectionBand("G. Bibliografía básica y complementaria"),
    ...bibliographyChildren(input),
    textParagraph("NOTA: Durante todo el periodo el profesor utilizará un portafolio docente digital donde respaldará el material empleado para el desarrollo de la asignatura.", { bold: true, before: 200, after: 180 }),
    sectionBand("H. Aprobación"),
    textParagraph("Esta sección se completa y aprueba fuera del sistema.", { before: 120, after: 100 }),
    fixedTable(PORTRAIT_WIDTH, approvalWidths, [
      new TableRow({ tableHeader: true, children: ["Actividad", "Nombre", "Función", "Firma"].map((label, index) =>
        tableCell(label, { width: approvalWidths[index] ?? 1800, bold: true, fill: LIGHT_BLUE, alignment: AlignmentType.CENTER })) }),
      new TableRow({ cantSplit: true, children: [
        tableCell("Aprobación", { width: approvalWidths[0]!, bold: true }),
        tableCell("", { width: approvalWidths[1]! }),
        tableCell("Director/a de carrera", { width: approvalWidths[2]! }),
        tableCell(Array.from({ length: 6 }, () => textParagraph("\u00A0", { after: 80 })), { width: approvalWidths[3]! }),
      ] }),
    ]),
  ];

  const document = new Document({
    creator: "Aplicación de planes docentes y guías didácticas UTPL",
    title: `Plan docente - ${input.project.subjectName}`,
    description: "Plan docente generado para revisión y aprobación externa.",
    styles: {
      default: {
        document: { run: { font: "Arial", size: 20, color: BLACK }, paragraph: { spacing: { line: 276 } } },
      },
      paragraphStyles: [
        {
          id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
          run: { font: "Arial", bold: true, size: 28, color: BLUE },
          paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 0 },
        },
      ],
    },
    numbering: {
      config: [{
        reference: "plan-bullets",
        levels: [{
          level: 0,
          format: "bullet",
          text: "•",
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 360, hanging: 180 } } },
        }],
      }],
    },
    sections: [
      portraitSection(coverChildren(input)),
      portraitSection(mainPortrait, { properties: { type: SectionType.NEXT_PAGE } }),
      {
        properties: {
          type: SectionType.NEXT_PAGE,
          page: {
            size: { orientation: PageOrientation.LANDSCAPE },
            margin: { top: LANDSCAPE_MARGIN, right: LANDSCAPE_MARGIN, bottom: LANDSCAPE_MARGIN, left: LANDSCAPE_MARGIN },
          },
        },
        footers: { default: pageFooter() },
        children: scheduleTables(input),
      },
      {
        properties: {
          type: SectionType.NEXT_PAGE,
          page: {
            size: { orientation: PageOrientation.LANDSCAPE },
            margin: { top: LANDSCAPE_MARGIN, right: LANDSCAPE_MARGIN, bottom: LANDSCAPE_MARGIN, left: LANDSCAPE_MARGIN },
          },
        },
        footers: { default: pageFooter() },
        children: evaluationLandscape,
      },
      portraitSection(finalPortrait, { properties: { type: SectionType.NEXT_PAGE } }),
    ],
  });
  return Packer.toBuffer(document);
}
