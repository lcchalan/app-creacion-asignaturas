import "dotenv/config";
import OpenAI from "openai";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer, type IncomingMessage } from "node:http";
import { URL } from "node:url";
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import {
  Document, HeadingLevel, ImageRun, Packer, Paragraph, Table, TableCell, TableRow,
  TextRun, WidthType,
} from "docx";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import * as XLSX from "xlsx";
import {
  buildCanonicalGuide,
  CANONICAL_GUIDE_SCHEMA_VERSION,
  canonicalGuideDocumentSchema,
} from "./canonical-guide.js";
import { parseMatrix, requiredColumns } from "./services/matrix-service.js";
import { database, checkDatabaseConnection } from "./db/client.js";

const port = Number.parseInt(process.env.PORT ?? "3000", 10);
const serverName =
  process.env.MCP_SERVER_NAME ?? "app-creacion-asignaturas";
const serverVersion =
  process.env.MCP_SERVER_VERSION ?? "1.0.0";
const formFileUrl = new URL("../public/index.html", import.meta.url);
const appScriptFileUrl = new URL(
  "../public/app.js",
  import.meta.url,
);
const academicOfferFileUrl = new URL(
  "../public/academic-offer.js",
  import.meta.url,
);

const stylesFileUrl = new URL(
  "../public/styles.css",
  import.meta.url,
);
const editorStylesFileUrl = new URL(
  "../public/editor-rich.css",
  import.meta.url,
);
const canonicalGuideV1SchemaFileUrl = new URL(
  "../schemas/guide-canonical-v1.schema.json",
  import.meta.url,
);
const canonicalGuideV2SchemaFileUrl = new URL(
  "../schemas/guide-canonical-v2.schema.json",
  import.meta.url,
);
const knowledgeDirectoryUrl = new URL("../knowledge/", import.meta.url);

async function readKnowledgeFile(fileName: string): Promise<string> {
  return (
    await readFile(new URL(fileName, knowledgeDirectoryUrl), "utf8")
  ).trim();
}

const fallbackInstitutionalKnowledge = {
  specification: await readKnowledgeFile("especificacion-funcional-v1.txt"),
  rea: await readKnowledgeFile("indicaciones-rea.txt"),
  apa: await readKnowledgeFile("normas-apa.txt"),
  methodologies: await readKnowledgeFile("metodologias-activas.txt"),
};

const openaiModel =
  process.env.OPENAI_MODEL ?? "gpt-5.6";
const openaiImageModel =
  process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-1";

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  : undefined;
const matrixRowSchema = z.object({
  Semana: z.string().trim().min(1),
  "Resultado de aprendizaje": z.string().trim().min(1),
  "Unidad/Contenido": z.string().trim().min(1),
  Metodología: z.string().trim().min(1),
});

const utplGenericCompetencySchema = z.enum([
  "Desarrollo personal integral",
  "Trabajo colaborativo",
  "Innovación y emprendimiento con visión de propósito",
  "Mentalidad sostenible",
  "Ciudadanía global",
]);

const uniqueAcademicTextListSchema = z.array(z.string().trim().min(1).max(1000))
  .min(1)
  .max(100)
  .refine(
    (items) => new Set(items.map((item) => item.toLocaleLowerCase("es"))).size === items.length,
    "Los elementos no pueden repetirse.",
  );

const academicProfileSchema = {
  professionalProfileCompetencies: uniqueAcademicTextListSchema,
  graduateProfileResults: uniqueAcademicTextListSchema,
  utplGenericCompetencies: z.array(utplGenericCompetencySchema).min(1).max(5)
    .refine((items) => new Set(items).size === items.length, "Las competencias no pueden repetirse."),
};

const generationRequestSchema = z.object({
  projectId: z.string().uuid().optional(),
  week: z.number().int().min(1).max(100),
  project: z.object({
    projectName: z.string().trim().min(1).max(200),
    level: z.string().trim().min(1).max(100),
    faculty: z.string().trim().min(1).max(200),
    career: z.string().trim().min(1).max(200),
    professorName: z.string().trim().min(1).max(200),
    subjectCode: z.string().trim().min(1).max(100),
    subjectName: z.string().trim().min(1).max(200),
    subjectType: z.string().trim().min(1).max(100).default("GENERAL"),
    modality: z.string().trim().min(1).max(150),
    academicPeriod: z.string().trim().min(1).max(100),
    ...academicProfileSchema,
    weeks: z
      .number()
      .int()
      .min(1)
      .max(100),
  }),
  matrixRows: z.array(matrixRowSchema).min(1).max(1000),
  bibliography: z.object({
    basic: z.string().trim().min(1).max(20_000),
    complementary: z.string().trim().min(1).max(20_000),
    rea: z.string().trim().max(20_000).default(""),
  }),
  adjustmentInstructions: z.string().trim().max(10_000).optional().default(""),
  currentContent: z.string().trim().max(100_000).optional().default(""),
  attachments: z.array(z.object({
    fileName: z.string().trim().regex(/\.(pdf|docx|txt)$/i),
    mimeType: z.enum([
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
    ]),
    content: z.string().min(1).max(14_000_000),
  })).max(3).optional().default([]),
});

type GenerationRequest = z.infer<
  typeof generationRequestSchema
>;

const wordRequestSchema = z.object({
  project: z.object({
    projectName: z.string().trim().min(1).max(200),
    subjectName: z.string().trim().min(1).max(200),
    career: z.string().trim().min(1).max(200),
    modality: z.string().trim().min(1).max(150),
    academicPeriod: z.string().trim().min(1).max(100),
    totalWeeks: z.number().int().min(1).max(100),
  }),
  weeks: z.array(z.object({
    week: z.number().int().min(1).max(100),
    content: z.string().trim().min(1).max(150_000),
  })).min(1).max(100),
});

const visualProposalSchema = z.object({
  id: z.string().trim().min(1).max(100),
  title: z.string().trim().min(1).max(240),
  topic: z.string().trim().min(1).max(500),
  purpose: z.string().trim().min(1).max(1000),
  type: z.string().trim().min(1).max(120),
  insertionAfter: z.string().trim().min(1).max(2000),
  altText: z.string().trim().min(1).max(1000),
  source: z.string().trim().min(1).max(240).default("Elaboración propia mediante IA"),
  prompt: z.string().trim().min(1).max(6000),
  styles: z.array(z.object({
    id: z.string().trim().min(1).max(80),
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().min(1).max(500),
  })).length(3),
});

const assistedResourceProposalSchema = visualProposalSchema.extend({
  kind: z.enum(["image", "video_script", "genially", "storytelling"]).default("image"),
});

const generateVisualSchema = z.object({
  projectId: z.string().uuid().optional(),
  week: z.number().int().min(1).max(100),
  figureNumber: z.number().int().min(1).max(100),
  proposal: visualProposalSchema,
  styleId: z.string().trim().min(1).max(80),
});

const generateAssistedResourceSchema = z.object({
  projectId: z.string().uuid().optional(),
  week: z.number().int().min(1).max(100),
  proposal: assistedResourceProposalSchema.refine((proposal) => proposal.kind !== "image"),
  styleId: z.string().trim().min(1).max(80),
});

const persistedWeekSchema = z.object({
  status: z.enum(["pending", "draft", "review", "approved"]),
  draftContent: z.string().max(150_000).optional().default(""),
  approvedContent: z.string().max(150_000).optional().default(""),
  approvedAt: z.string().datetime().optional(),
  version: z.number().int().min(0).default(0),
});

const projectPersistenceSchema = z.object({
  projectId: z.string().uuid().optional(),
  currentWeek: z.number().int().min(1).max(100),
  project: generationRequestSchema.shape.project,
  bibliography: generationRequestSchema.shape.bibliography,
  matrixFileName: z.string().max(255).optional().default(""),
  matrixRows: z.array(matrixRowSchema).min(1).max(1000),
  weekStates: z.record(z.string(), persistedWeekSchema),
}).superRefine((input, context) => {
  const matrixWeeks = new Set(input.matrixRows.map((row) => Number.parseInt(row.Semana, 10)));
  const validSequence = matrixWeeks.size === input.project.weeks &&
    Array.from({ length: input.project.weeks }, (_, index) => index + 1)
      .every((week) => matrixWeeks.has(week));
  if (!validSequence) {
    context.addIssue({
      code: "custom",
      path: ["matrixRows"],
      message: "Las semanas de la matriz deben formar una secuencia completa desde 1.",
    });
  }
  if (input.currentWeek > input.project.weeks) {
    context.addIssue({
      code: "custom",
      path: ["currentWeek"],
      message: "La semana actual no puede superar el total de semanas del proyecto.",
    });
  }
});

function passwordHash(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

function passwordMatches(password: string, stored: string | null) {
  if (!stored) return false;
  const [salt, expectedHex] = stored.split(":");
  if (!salt || !expectedHex) return false;
  const actual = scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHex, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function cookieValue(request: IncomingMessage, name: string) {
  return (request.headers.cookie ?? "").split(";").map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1);
}

async function authenticatedUser(request: IncomingMessage) {
  const token = cookieValue(request, "ggd_session");
  if (!token) return null;
  const session = await database.userSession.findUnique({
    where: { tokenHash: createHash("sha256").update(token).digest("hex") },
    include: { user: { include: { roles: { include: { role: true } } } } },
  });
  if (!session || session.expiresAt <= new Date() || !session.user.active) return null;
  return session.user;
}

async function requireUser(request: IncomingMessage) {
  const user = await authenticatedUser(request);
  if (!user) throw Object.assign(new Error("Debe iniciar sesión."), { statusCode: 401 });
  return user;
}

function isAdmin(user: Awaited<ReturnType<typeof requireUser>>) {
  return user.roles.some((entry) => entry.role.code === "ADMIN");
}

const stageTotals = { PEER: 35, QUALITY: 30, DIITEP: 35 } as const;
const stageRole = { PEER: "REVIEWER", QUALITY: "QUALITY", DIITEP: "DIITEP" } as const;

function canReview(user: Awaited<ReturnType<typeof requireUser>>, stage: keyof typeof stageRole) {
  const roles = new Set(user.roles.map((entry) => entry.role.code));
  return roles.has("ADMIN") || roles.has(stageRole[stage]);
}

function categoryFor(percentage: number) {
  if (percentage >= 90) return "Excelente";
  if (percentage >= 80) return "Satisfactoria";
  if (percentage >= 70) return "En proceso de mejora";
  return "Insuficiente";
}

function normalizedIndicators<T extends { stage: keyof typeof stageTotals; score: unknown; active: boolean }>(items: T[]) {
  return items.map((item) => {
    if (!item.active) return { ...item, score: Number(item.score) };
    const activeTotal = items.filter((entry) => entry.active && entry.stage === item.stage)
      .reduce((sum, entry) => sum + Number(entry.score), 0);
    return { ...item, score: activeTotal > 0 ? Number(item.score) * stageTotals[item.stage] / activeTotal : 0 };
  });
}

const contextScopeSchema = z.object({
  academicLevels: z.array(z.string().trim().min(1).max(100)).max(20).default([]),
  modalities: z.array(z.string().trim().min(1).max(150)).max(20).default([]),
  durations: z.array(z.number().int().min(1).max(100)).max(20).default([]),
  subjectTypes: z.array(z.string().trim().min(1).max(100)).max(20).default([]),
  priority: z.number().int().min(1).max(999).default(100),
});

type PromptContext = {
  level: string;
  modality: string;
  weeks: number;
  subjectType?: string;
};

function appliesToContext(item: {
  academicLevels: string[];
  modalities: string[];
  durations: number[];
  subjectTypes: string[];
}, context: PromptContext) {
  const normalized = (value: string) => value.trim().toLocaleLowerCase("es");
  const contains = (values: string[], value: string) =>
    !values.length || values.some((entry) => normalized(entry) === normalized(value));
  return contains(item.academicLevels, context.level)
    && contains(item.modalities, context.modality)
    && (!item.durations.length || item.durations.includes(context.weeks))
    && contains(item.subjectTypes, context.subjectType || "GENERAL");
}

function impactChecksum(input: unknown) {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

function extractRules(content: string) {
  return content.split(/\r?\n/)
    .map((line) => line.replace(/^[-*#\d.)\s]+/, "").trim())
    .filter((line) => line.length >= 20)
    .slice(0, 30);
}

function analyzeImpactDraft(input: {
  kind: "SPECIFICATION" | "DOCUMENT";
  key: string;
  title: string;
  content: string;
  academicLevels: string[];
  modalities: string[];
  durations: number[];
  subjectTypes: string[];
  priority: number;
  appliesToAll?: boolean;
}, existing: Array<{ title: string; content: string; priority: number }>) {
  const rules = extractRules(input.content);
  const newTerms = new Set(input.content.toLocaleLowerCase("es").match(/[a-záéíóúñ]{5,}/g) || []);
  const comparisons = existing.map((item) => {
    const terms = new Set(item.content.toLocaleLowerCase("es").match(/[a-záéíóúñ]{5,}/g) || []);
    const overlap = [...newTerms].filter((term) => terms.has(term)).length;
    return {
      title: item.title,
      relationship: overlap >= 12 ? "Posible superposición" : "Complementario",
      detail: overlap >= 12
        ? "Comparte conceptos y debe verificarse que no establezca cantidades, prioridades o prohibiciones diferentes."
        : "No se detecta una superposición textual relevante.",
    };
  });
  const conflictPatterns = [
    { label: "Cantidad de citas", expression: /(?:mínim[oa]|al menos|exactamente)\s+\d+\s+citas?/gi },
    { label: "Cantidad de preguntas", expression: /(?:mínim[oa]|al menos|exactamente)\s+\d+\s+preguntas?/gi },
    { label: "Frecuencia semanal", expression: /(?:cada|por)\s+semana/gi },
  ];
  const contradictions = conflictPatterns.flatMap((pattern) => {
    const proposed = input.content.match(pattern.expression) || [];
    const current = existing.flatMap((item) => item.content.match(pattern.expression) || []);
    return proposed.length && current.length
      ? [{ severity: "REVIEW", topic: pattern.label, current: current[0], proposed: proposed[0],
        recommendation: "Compare ambas reglas y confirme cuál debe prevalecer antes de activar." }]
      : [];
  });
  return {
    summary: `La actualización incorpora ${rules.length} reglas o directrices identificables.`,
    newRules: rules.slice(0, 10),
    scope: {
      appliesToAll: Boolean(input.appliesToAll),
      academicLevels: input.academicLevels,
      modalities: input.modalities,
      durations: input.durations,
      subjectTypes: input.subjectTypes,
    },
    improvements: [
      "Actualiza el contexto que se incorporará en futuras generaciones compatibles.",
      "Mantiene intactas las semanas y evaluaciones generadas con versiones anteriores.",
    ],
    comparisons,
    contradictions,
    affectedPromptSections: input.kind === "SPECIFICATION"
      ? ["Jerarquía y comportamiento de la generación", "Estructura de salida"]
      : ["Conocimiento institucional aplicable"],
    recommendation: contradictions.length ? "APROBAR_CON_REVISION" : "APROBAR",
  };
}

function json(response: import("node:http").ServerResponse, status: number, body: unknown, headers = {}) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...headers,
  });
  response.end(JSON.stringify(body));
}

function databaseWeekStatus(status: string) {
  if (status === "approved") return "APPROVED" as const;
  if (status === "review") return "REQUIRES_REVIEW" as const;
  if (status === "draft") return "IN_REVIEW" as const;
  return "PENDING" as const;
}

function browserWeekStatus(status: string) {
  if (status === "APPROVED") return "approved";
  if (status === "REQUIRES_REVIEW") return "review";
  if (status === "IN_REVIEW" || status === "GENERATED") return "draft";
  return "pending";
}

function canonicalDocumentChecksum(document: unknown) {
  return createHash("sha256").update(JSON.stringify(document)).digest("hex");
}

function canonicalDownloadName(subjectName: string, schemaVersion: string) {
  const safeName = subjectName
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const majorVersion = schemaVersion.split(".")[0] || "2";
  return `${safeName || "guia-didactica"}.canonical.v${majorVersion}.json`;
}

function markdownRuns(text: string): TextRun[] {
  const runs: TextRun[] = [];
  const expression = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let position = 0;
  for (const match of text.matchAll(expression)) {
    if (match.index! > position) runs.push(new TextRun(text.slice(position, match.index)));
    const token = match[0];
    runs.push(new TextRun({
      text: token.replace(/^\*{1,2}|\*{1,2}$/g, ""),
      bold: token.startsWith("**"),
      italics: !token.startsWith("**"),
    }));
    position = match.index! + token.length;
  }
  if (position < text.length) runs.push(new TextRun(text.slice(position)));
  return runs.length ? runs : [new TextRun(text)];
}

function tableCells(line: string): string[] {
  return line.trim().replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim());
}

function isTableSeparator(line: string): boolean {
  const cells = tableCells(line);
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function markdownParagraphs(markdown: string): Array<Paragraph | Table> {
  const originalLines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const lines = originalLines.filter((line, index) => {
    if (index === 0) return true;
    const current = line.trim().replace(/\s+/g, " ").toLowerCase();
    const previous = originalLines[index - 1]?.trim().replace(/\s+/g, " ").toLowerCase() ?? "";
    return !(current && current === previous && /^(?:\*\*)?tabla\s+\d+/i.test(current));
  });
  const blocks: Array<Paragraph | Table> = [];
  let tableNumber = 0;

  for (let index = 0; index < lines.length; index += 1) {
    const line = (lines[index] ?? "").trim();
    const nextLine = (lines[index + 1] ?? "").trim();
    if (line.includes("|") && isTableSeparator(nextLine)) {
      tableNumber += 1;
      let previousIndex = index - 1;
      while (previousIndex >= 0 && !(lines[previousIndex] ?? "").trim()) previousIndex -= 1;
      const previousLine = (lines[previousIndex] ?? "").trim();
      if (!/^(?:\*\*)?tabla\s+\d+/i.test(previousLine)) {
        blocks.push(new Paragraph({
          children: [new TextRun({ text: `Tabla ${tableNumber}`, bold: true })],
          spacing: { before: 180, after: 80 },
        }));
      }
      const rows = [tableCells(line)];
      index += 2;
      while (index < lines.length && (lines[index] ?? "").includes("|")) {
        rows.push(tableCells(lines[index] ?? ""));
        index += 1;
      }
      index -= 1;
      blocks.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: rows.map((cells, rowIndex) => new TableRow({
          children: cells.map((cell) => new TableCell({
            children: [new Paragraph({
              children: markdownRuns(cell),
              spacing: { before: 60, after: 60 },
            })],
            shading: rowIndex === 0 ? { fill: "DCE6F1" } : undefined,
          })),
          tableHeader: rowIndex === 0,
        })),
      }));
      continue;
    }
    if (!line) {
      blocks.push(new Paragraph(""));
      continue;
    }
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      const marks = heading[1] ?? "#";
      const headingText = heading[2] ?? "";
      const level = marks.length === 1
        ? HeadingLevel.HEADING_1
        : marks.length === 2
          ? HeadingLevel.HEADING_2
          : HeadingLevel.HEADING_3;
      blocks.push(new Paragraph({ heading: level, children: markdownRuns(headingText) }));
      continue;
    }
    const bullet = line.match(/^[-*]\s+(.+)$/);
    if (bullet) {
      blocks.push(new Paragraph({ bullet: { level: 0 }, children: markdownRuns(bullet[1] ?? "") }));
      continue;
    }
    const numbered = line.match(/^\d+[.)]\s+(.+)$/);
    if (numbered) {
      blocks.push(new Paragraph({ numbering: { reference: "approved-weeks", level: 0 }, children: markdownRuns(numbered[1] ?? "") }));
      continue;
    }
    blocks.push(new Paragraph({ children: markdownRuns(line), spacing: { after: 120 } }));
  }
  return blocks;
}

async function markdownParagraphsWithImages(markdown: string): Promise<Array<Paragraph | Table>> {
  const imagePattern = /!\[([^\]]*)\]\(\/api\/generated-images\/([0-9a-f-]{36})\)/gi;
  const blocks: Array<Paragraph | Table> = [];
  let cursor = 0;
  for (const match of markdown.matchAll(imagePattern)) {
    const index = match.index ?? 0;
    blocks.push(...markdownParagraphs(markdown.slice(cursor, index)));
    const image = await database.generatedImage.findUnique({ where: { id: match[2] } });
    if (image) {
      blocks.push(new Paragraph({
        alignment: "center",
        children: [new ImageRun({
          data: Buffer.from(image.imageData),
          transformation: { width: 560, height: 560 },
          type: "png",
        })],
        spacing: { before: 180, after: 80 },
      }));
      blocks.push(new Paragraph({
        alignment: "center",
        children: [new TextRun({ text: `Figura ${image.figureNumber}. ${image.title}`, italics: true })],
      }));
      blocks.push(new Paragraph({
        alignment: "center",
        children: [new TextRun({ text: `Fuente: ${image.source}`, size: 18 })],
        spacing: { after: 180 },
      }));
    }
    cursor = index + match[0].length;
  }
  blocks.push(...markdownParagraphs(markdown.slice(cursor)));
  return blocks;
}

function jsonObjectFromText(value: string): unknown {
  const cleaned = value.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) return {};
  return JSON.parse(cleaned.slice(start, end + 1));
}

async function analyzeAssistedResourceOpportunities(content: string, subjectName: string) {
  if (!openai) return [];
  const analysis = await openai.responses.create({
    model: openaiModel,
    instructions: `Analiza contenido universitario y detecta oportunidades para enriquecerlo con recursos de utilidad didáctica real.
Devuelve JSON válido, sin Markdown, con la forma {"proposals":[...]}. Incluye de cero a tres propuestas.
Cada propuesta debe tener: id, kind, title, topic, purpose, type, insertionAfter, altText, source, prompt y styles.
kind debe ser exactamente uno de: image, video_script, genially o storytelling.
Selecciona el tipo más pertinente según el contenido:
- image: procesos, relaciones, jerarquías, componentes o síntesis que necesitan representación visual.
- video_script: explicaciones, demostraciones, casos o secuencias que se benefician de narración audiovisual.
- genially: recorridos interactivos, exploraciones, decisiones, clasificación, práctica o contenidos por capas.
- storytelling: conceptos o problemas que se comprenden mejor mediante una situación, personajes, conflicto y resolución.
insertionAfter debe copiar literalmente un párrafo completo y único del contenido, después del cual se insertará el recurso.
styles debe contener exactamente tres objetos {id,name,description}, adaptados al tipo de recurso y distintos entre sí.
Para video_script, las tres opciones deben ser enfoques de guion; para genially, estructuras interactivas; para storytelling, enfoques narrativos; para image, estilos visuales.
No propongas recursos decorativos ni repitas el mismo contenido. No inventes cifras, fuentes, citas, fórmulas ni contenidos.
Para datos exactos, tablas o fórmulas, no propongas generación artística.
El prompt debe ser autosuficiente, académico, accesible y fiel al contenido. En imágenes, evita logotipos, marcas, rostros identificables y texto extenso.
Distribuye las propuestas según su pertinencia; no es obligatorio incluir los cuatro tipos ni generar tres propuestas.`,
    input: `Asignatura: ${subjectName}\n\nCONTENIDO:\n${content.slice(0, 90_000)}`,
  });
  try {
    const parsed = z.object({
      proposals: z.array(assistedResourceProposalSchema).max(3).default([]),
    }).parse(jsonObjectFromText(analysis.output_text));
    return parsed.proposals.filter((proposal) => content.includes(proposal.insertionAfter));
  } catch {
    return [];
  }
}

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const methodologyMarkers = [
  "M1. Aprendizaje Orientado a Proyectos",
  "M2. Aprendizaje Basado en Problemas",
  "M3. Aprendizaje Basado en la Investigación",
  "M4. Aprendizaje Servicio",
  "M5. Aprendizaje Colaborativo",
  "M6. Aprendizaje experiencial",
  "M7. Aprendizaje Cooperativo",
  "M8. Aprendizaje basado en Casos",
  "M9. Aula Invertida",
  "M10. Gamificación",
  "M11. Aprendizaje basado en Retos",
  "M12. Aprendizaje basado en preguntas",
];

function methodologyKnowledge(methodologies: string): string {
  const source = fallbackInstitutionalKnowledge.methodologies;
  const requested = normalizeText(methodologies);
  const selected: string[] = [];

  methodologyMarkers.forEach((marker, index) => {
    const markerName = normalizeText(
      marker.replace(/^M\d+\.\s*/, ""),
    );
    const aliases = markerName
      .split(/\s+[-/(]/)
      .filter((alias) => alias.length >= 5);

    if (
      !requested.includes(markerName) &&
      !aliases.some((alias) => requested.includes(alias))
    ) {
      return;
    }

    const start = source.indexOf(marker);
    if (start < 0) {
      return;
    }

    const nextMarker = methodologyMarkers[index + 1];
    const end = nextMarker
      ? source.indexOf(nextMarker, start + marker.length)
      : source.length;
    selected.push(source.slice(start, end > start ? end : source.length));
  });

  if (!selected.length) {
    return `
La metodología declarada no coincide inequívocamente con una de las doce
metodologías institucionales. No la sustituya ni invente fases. Aplique
únicamente la información explícita de la matriz y requiera confirmación
docente si faltan procedimientos.
`.trim();
  }

  return selected.join("\n\n").slice(0, 24_000);
}

function buildGenerationInstructions(
  methodologies: string,
): string {
  return `
Actúa como diseñador instruccional y experto en elaboración de
guías didácticas universitarias para educación en línea y a distancia.

Genera exclusivamente la semana solicitada.

JERARQUÍA DE REGLAS:
1. Versión activa de la especificación funcional.
2. Matriz y datos proporcionados por el profesor.
3. Versiones activas de indicadores generales, metodología institucional, normas APA y
   criterios de REA.
4. Bibliografía temática proporcionada por el profesor.

Si existe una contradicción, aplica la especificación funcional activa.
Los documentos institucionales orientan la elaboración, pero no son
bibliografía temática y no deben citarse automáticamente.

FIDELIDAD ESTRUCTURAL OBLIGATORIA:

1. La columna "Unidad/Contenido" de la matriz es la única fuente autorizada
   para crear encabezados temáticos. Reproduce literalmente y en el mismo
   orden únicamente la unidad, los temas y los subtemas allí declarados.
2. No inventes, completes, deduzcas, subdividas ni renumeres temas o
   subtemas, aunque parezcan didácticamente convenientes.
3. No muestres al inicio un índice ni una lista que repita los contenidos
   que después se desarrollarán.
4. No conviertas en títulos, subtítulos ni apartados numerados expresiones
   funcionales como "Ruta didáctica de la semana", "Introducción",
   "Desarrollo de los contenidos", "Aplicación de la metodología",
   "Estudio de caso", "Ejemplo", "Diálogo didáctico", "Actividad",
   "Orientaciones", "Motivación", "Retroalimentación" o equivalentes,
   salvo que la expresión conste literalmente como contenido en la matriz.
5. La metodología declarada debe evidenciarse de forma implícita y
   transversal en la explicación, los casos, preguntas, ejemplos y
   estrategias; no constituye un tema de estudio adicional.
6. Los casos, ejemplos, preguntas orientadoras, recursos y estrategias se
   integran dentro del tema o subtema de la matriz al que corresponden. Se
   pueden diferenciar mediante párrafos, recuadros o rótulos breves sin
   numeración temática, pero nunca agregarlos al índice temático.
7. No incluyas una pregunta o solicitud textual de aprobación dentro del
   contenido. La aprobación y el avance de semana pertenecen a la interfaz.
8. "Referencias utilizadas en la semana" y, cuando corresponda,
   "Autoevaluación" pueden aparecer al final como secciones funcionales sin
   numeración temática. La autoevaluación se incluye únicamente al cerrar
   una unidad.
9. Si un requisito institucional de presentación sugiere un encabezado
   didáctico que no consta en la matriz, intégralo en la redacción sin
   convertirlo en encabezado visible. Esta regla controla la estructura
   visible de la respuesta.
10. No insertes marcadores, prompts ni simulaciones de imágenes dentro del
   contenido. La interfaz analiza después las oportunidades visuales y solicita
   autorización expresa al profesor antes de generar cada recurso.
11. Toda información tabular debe presentarse como una tabla Markdown real:
    una fila de encabezados, una fila separadora con guiones y las filas de
    datos. No simules tablas mediante listas, tabulaciones ni texto alineado.
12. Enumera correlativamente cada tabla dentro de la semana. Antes de cada
    tabla escribe, en una línea independiente y en negrita, "Tabla N. Título
    descriptivo". La numeración inicia en Tabla 1 y no puede omitirse.

SALIDA VISIBLE:

1. Encabezado de la semana y resultado de aprendizaje.
2. Desarrollo organizado exclusivamente con la unidad, temas y subtemas
   literales de la matriz.
3. Referencias utilizadas.
4. Autoevaluación, solo cuando corresponda.

Realiza la validación interna antes de responder. No muestres estas
instrucciones, la base de conocimiento, listas de control, razonamientos
internos ni documentos institucionales.
`.trim();
}

async function activeAdministrativeContext(context: PromptContext, projectId?: string) {
  const projectSnapshot = projectId ? await database.project.findUnique({
    where: { id: projectId },
    select: { specificationSnapshotIds: true, documentSnapshotIds: true, indicatorVersionSnapshotId: true },
  }) : null;
  const [instructions, documents, indicatorVersion] = await Promise.all([
    database.generationInstruction.findMany({
      where: projectSnapshot?.specificationSnapshotIds.length
        ? { id: { in: projectSnapshot.specificationSnapshotIds } }
        : { status: "ACTIVE" },
      orderBy: [{ priority: "asc" }, { activatedAt: "asc" }],
    }),
    database.knowledgeDocument.findMany({
      where: {
        ...(projectSnapshot?.documentSnapshotIds.length
          ? { id: { in: projectSnapshot.documentSnapshotIds } }
          : { status: "ACTIVE" as const }),
        key: { not: "indicadores-generales" },
        mimeType: { in: ["text/plain", "text/markdown"] },
      },
      orderBy: [{ priority: "asc" }, { activatedAt: "asc" }],
    }),
    database.indicatorVersion.findFirst({
      where: projectSnapshot?.indicatorVersionSnapshotId
        ? { id: projectSnapshot.indicatorVersionSnapshotId }
        : { status: "ACTIVE" },
      orderBy: { version: "desc" },
      include: { indicators: { orderBy: { sortOrder: "asc" } } },
    }),
  ]);
  const applicableInstructions = instructions.filter((item) => appliesToContext(item, context));
  const applicableDocuments = documents.filter((item) => item.appliesToAll || appliesToContext(item, context));
  if (projectId && projectSnapshot && !projectSnapshot.specificationSnapshotIds.length
      && !projectSnapshot.documentSnapshotIds.length && !projectSnapshot.indicatorVersionSnapshotId) {
    await database.project.update({
      where: { id: projectId },
      data: {
        specificationSnapshotIds: applicableInstructions.map((item) => item.id),
        documentSnapshotIds: applicableDocuments.map((item) => item.id),
        indicatorVersionSnapshotId: indicatorVersion?.id || null,
      },
    });
  }
  const knowledgeTexts = await Promise.all(applicableDocuments.map(async (document) => {
    try {
      const content = document.contentMarkdown
        || await readFile(new URL(`../${document.storagePath}`, import.meta.url), "utf8");
      return `### ${document.title}\n${content}`;
    } catch {
      return "";
    }
  }));
  const activeKeys = new Set(applicableDocuments.map((document) => document.key));
  const fallbackCatalog: Array<[string, string, string]> = [
    ["especificacion-funcional", "Especificación funcional", fallbackInstitutionalKnowledge.specification],
    ["metodologias-activas", "Metodologías activas", fallbackInstitutionalKnowledge.methodologies],
    ["normas-apa", "Normas APA", fallbackInstitutionalKnowledge.apa],
    ["indicaciones-rea", "Indicaciones REA", fallbackInstitutionalKnowledge.rea],
  ];
  const fallbackItems = fallbackCatalog.filter(([key]) => !activeKeys.has(key));
  const fallback = fallbackItems.length
    ? `CONOCIMIENTO INSTITUCIONAL DE RESPALDO:\n${fallbackItems.map(([, title, content]) => `### ${title}\n${content}`).join("\n\n")}`
    : "";
  return [
    applicableInstructions.length ? `ESPECIFICACIONES FUNCIONALES APLICABLES:\n${applicableInstructions.map((item) =>
      `### ${item.title} · prioridad ${item.priority}\n${item.content}`).join("\n\n")}` : "",
    indicatorVersion
      ? `INDICADORES GENERALES DE LA GUÍA — VERSIÓN ${indicatorVersion.version}:\n${indicatorVersion.indicators.filter((indicator) => indicator.active).map((indicator) =>
        `- [${indicator.stage}] ${indicator.name || indicator.code}: ${indicator.description}`
      ).join("\n")}`
      : "",
    knowledgeTexts.some(Boolean) ? `CONOCIMIENTO ADMINISTRATIVO ACTIVO:\n${knowledgeTexts.filter(Boolean).join("\n\n")}` : "",
    fallback,
  ].filter(Boolean).join("\n\n");
}

function buildGenerationInput(
  request: GenerationRequest,
): string {
  const { week, project, bibliography } = request;
  const weekRows = request.matrixRows.filter(
    (row) => Number.parseInt(row.Semana, 10) === week,
  );
  if (!weekRows.length) {
    throw new Error(`La matriz no contiene información para la semana ${week}.`);
  }
  const learningOutcomes = [...new Set(weekRows.map(
    (row) => row["Resultado de aprendizaje"],
  ))].join("\n");
  const contents = weekRows.map((row) => row["Unidad/Contenido"]).join("\n");
  const methodologies = [...new Set(weekRows.map(
    (row) => row.Metodología,
  ))].join("\n");

  return `
Genera la semana ${week} de ${project.weeks} para la siguiente
asignatura:

Proyecto: ${project.projectName}
Nivel: ${project.level}
Facultad o unidad académica: ${project.faculty}
Carrera o programa: ${project.career}
Modalidad: ${project.modality}
Periodo académico: ${project.academicPeriod}
Asignatura: ${project.subjectName}

COMPETENCIAS DEL PERFIL PROFESIONAL:
${project.professionalProfileCompetencies.map((item) => `- ${item}`).join("\n")}

RESULTADOS DE PERFIL DE EGRESO:
${project.graduateProfileResults.map((item) => `- ${item}`).join("\n")}

COMPETENCIAS GENÉRICAS DE LA UTPL:
${project.utplGenericCompetencies.map((item) => `- ${item}`).join("\n")}

RESULTADO DE APRENDIZAJE:
${learningOutcomes}

UNIDADES Y CONTENIDOS PLANIFICADOS:
${contents}

METODOLOGÍA:
${methodologies}

BIBLIOGRAFÍA BÁSICA:
${bibliography.basic}

BIBLIOGRAFÍA COMPLEMENTARIA:
${bibliography.complementary}

RECURSOS EDUCATIVOS ABIERTOS:
${bibliography.rea || "No se proporcionaron REA."}

${request.adjustmentInstructions ? `
AJUSTE SOLICITADO POR EL PROFESOR:
${request.adjustmentInstructions}

CONTENIDO ACTUAL QUE DEBE REVISARSE:
${request.currentContent || "No se proporcionó contenido previo."}

Genere una versión completa revisada de la semana. Aplique exactamente
las instrucciones del profesor, conserve los fragmentos que no requieren
cambios y mantenga el cumplimiento de la matriz y de las reglas
institucionales. No agregue encabezados temáticos que no consten
literalmente en la columna "Unidad/Contenido", aunque aparezcan en el
contenido actual que se está revisando. Si puedes agregar subtemas que se deriben de los temas declarados.
` : ""}
`.trim();
}

function createMcpServer(): McpServer {
  const server = new McpServer({
    name: serverName,
    version: serverVersion,
  });

  server.registerTool(
    "hello_world",
    {
      title: "Saludar",
      description:
        "Comprueba que el servidor MCP funciona y devuelve un mensaje de bienvenida.",
      inputSchema: {
        name: z
          .string()
          .trim()
          .min(1)
          .max(100)
          .optional()
          .describe("Nombre opcional de la persona que recibirá el saludo."),
      },
      outputSchema: {
        message: z.string(),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async ({ name }) => {
      const message = name
        ? `¡Hola, ${name}! El servidor MCP funciona correctamente.`
        : "¡Hola! El servidor MCP funciona correctamente.";

      return {
        structuredContent: { message },
        content: [
          {
            type: "text",
            text: message,
          },
        ],
      };
    },
  );

  return server;
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  const maximumSize = 15_000_000;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;

    if (size > maximumSize) {
      throw new Error("El cuerpo de la solicitud supera el límite permitido.");
    }

    chunks.push(buffer);
  }

  if (chunks.length === 0) {
    return undefined;
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

const httpServer = createServer(async (request, response) => {
  try {
    const requestUrl = new URL(
      request.url ?? "/",
      `http://${request.headers.host ?? "localhost"}`,
    );
    if (
      request.method === "GET" &&
      requestUrl.pathname === "/health/database"
    ) {
      await checkDatabaseConnection();
      response.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      });
      response.end(JSON.stringify({ status: "ok", database: "postgresql" }));
      return;
    }
    if (request.method === "POST" && requestUrl.pathname === "/api/auth/register") {
      const body = z.object({
        firstName: z.string().trim().min(2).max(100),
        lastName: z.string().trim().min(2).max(100),
        nationalId: z.string().trim().min(6).max(20),
        email: z.string().trim().email().transform((value) => value.toLowerCase()),
        password: z.string().min(8).max(200),
      }).parse(await readJsonBody(request));
      const teacherRole = await database.role.findUnique({ where: { code: "TEACHER" } });
      if (!teacherRole) throw new Error("Ejecute el seed para crear el rol Profesor.");
      const user = await database.user.create({
        data: {
          firstName: body.firstName,
          lastName: body.lastName,
          nationalId: body.nationalId,
          email: body.email,
          displayName: `${body.firstName} ${body.lastName}`,
          passwordHash: passwordHash(body.password),
          roles: { create: { roleId: teacherRole.id } },
        },
      });
      json(response, 201, { ok: true, userId: user.id, role: "TEACHER" });
      return;
    }
    if (request.method === "POST" && requestUrl.pathname === "/api/auth/login") {
      const body = z.object({
        email: z.string().trim().email().transform((value) => value.toLowerCase()),
        password: z.string().min(1).max(200),
      }).parse(await readJsonBody(request));
      const user = await database.user.findUnique({ where: { email: body.email } });
      if (!user || !user.active || !passwordMatches(body.password, user.passwordHash)) {
        json(response, 401, { error: "Correo o contraseña incorrectos." });
        return;
      }
      const token = randomBytes(32).toString("base64url");
      await database.userSession.create({
        data: {
          userId: user.id,
          tokenHash: createHash("sha256").update(token).digest("hex"),
          expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000),
        },
      });
      json(response, 200, { ok: true }, {
        "Set-Cookie": `ggd_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=28800`,
      });
      return;
    }
    if (request.method === "POST" && requestUrl.pathname === "/api/auth/logout") {
      const token = cookieValue(request, "ggd_session");
      if (token) await database.userSession.deleteMany({
        where: { tokenHash: createHash("sha256").update(token).digest("hex") },
      });
      json(response, 200, { ok: true }, {
        "Set-Cookie": "ggd_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0",
      });
      return;
    }
    if (request.method === "GET" && requestUrl.pathname === "/api/auth/me") {
      const user = await authenticatedUser(request);
      json(response, 200, {
        user: user ? {
          id: user.id, firstName: user.firstName, lastName: user.lastName,
          displayName: user.displayName, email: user.email,
          roles: user.roles.map((entry) => entry.role.code),
        } : null,
      });
      return;
    }
    if (request.method === "GET" && requestUrl.pathname === "/api/admin/dashboard") {
      const admin = await requireUser(request);
      if (!isAdmin(admin)) { json(response, 403, { error: "Acceso exclusivo del administrador." }); return; }
      const [users, roles, periods, courses, assignments, projects, instructions, documents, indicatorVersions] = await Promise.all([
        database.user.findMany({
          orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
          select: {
            id: true, firstName: true, lastName: true, nationalId: true, email: true,
            active: true, mustChangePassword: true, createdAt: true,
            roles: { select: { role: { select: { code: true, name: true } } } },
          },
        }),
        database.role.findMany({ orderBy: { name: "asc" } }),
        database.academicPeriod.findMany({ orderBy: { createdAt: "desc" } }),
        database.course.findMany({ orderBy: { name: "asc" } }),
        database.teachingAssignment.findMany({
          orderBy: { createdAt: "desc" },
          include: {
            teacher: { select: { id: true, displayName: true, email: true } },
            course: true, period: true,
          },
        }),
        database.project.findMany({
          orderBy: { updatedAt: "desc" },
          select: {
            id: true, name: true, subjectCode: true, subjectName: true,
            professorName: true, academicPeriod: true, status: true,
            totalWeeks: true, updatedAt: true,
            weeks: { select: { status: true } },
          },
        }),
        database.generationInstruction.findMany({ orderBy: [{ key: "asc" }, { version: "desc" }] }),
        database.knowledgeDocument.findMany({
          where: { key: { not: "indicadores-generales" } },
          orderBy: [{ key: "asc" }, { version: "desc" }],
        }),
        database.indicatorVersion.findMany({
          orderBy: { version: "desc" },
          include: { indicators: { orderBy: { sortOrder: "asc" } } },
        }),
      ]);
      json(response, 200, { users, roles, periods, courses, assignments, projects, instructions, documents, indicatorVersions });
      return;
    }
    if (request.method === "POST" && requestUrl.pathname === "/api/admin/users") {
      const admin = await requireUser(request);
      if (!isAdmin(admin)) { json(response, 403, { error: "Acceso exclusivo del administrador." }); return; }
      const body = z.object({
        firstName: z.string().trim().min(2), lastName: z.string().trim().min(2),
        nationalId: z.string().trim().min(6),
        email: z.string().trim().email().transform((value) => value.toLowerCase()),
        roleCode: z.string().trim().min(1),
        temporaryPassword: z.string().min(8).max(200).optional(),
      }).parse(await readJsonBody(request));
      const temporaryPassword = body.temporaryPassword || randomBytes(9).toString("base64url");
      const selectedRole = await database.role.findUnique({ where: { code: body.roleCode } });
      if (!selectedRole) throw new Error("El rol seleccionado no existe.");
      const user = await database.user.create({
        data: {
          firstName: body.firstName, lastName: body.lastName, nationalId: body.nationalId,
          email: body.email, displayName: `${body.firstName} ${body.lastName}`,
          passwordHash: passwordHash(temporaryPassword), mustChangePassword: true,
          roles: { create: { roleId: selectedRole.id } },
        },
      });
      json(response, 201, { ok: true, userId: user.id, temporaryPassword });
      return;
    }
    const userAdminMatch = requestUrl.pathname.match(/^\/api\/admin\/users\/([0-9a-f-]+)$/i);
    if (request.method === "PATCH" && userAdminMatch) {
      const admin = await requireUser(request);
      if (!isAdmin(admin)) { json(response, 403, { error: "Acceso exclusivo del administrador." }); return; }
      const userId = z.string().uuid().parse(userAdminMatch[1]);
      const body = z.object({
        active: z.boolean().optional(),
        roleCode: z.string().trim().min(1).optional(),
        firstName: z.string().trim().min(2).optional(),
        lastName: z.string().trim().min(2).optional(),
        nationalId: z.string().trim().min(6).optional(),
        email: z.string().trim().email().transform((value) => value.toLowerCase()).optional(),
      }).parse(await readJsonBody(request));
      if (userId === admin.id && body.active === false) throw new Error("No puede desactivar su propia cuenta.");
      if (userId === admin.id && body.roleCode && body.roleCode !== "ADMIN") {
        throw new Error("No puede retirar su propio rol de administrador.");
      }
      await database.$transaction(async (transaction) => {
        if (body.firstName || body.lastName || body.nationalId || body.email) {
          const current = await transaction.user.findUniqueOrThrow({ where: { id: userId } });
          const firstName = body.firstName ?? current.firstName;
          const lastName = body.lastName ?? current.lastName;
          await transaction.user.update({
            where: { id: userId },
            data: { firstName, lastName, nationalId: body.nationalId, email: body.email, displayName: `${firstName} ${lastName}` },
          });
        }
        if (typeof body.active === "boolean") {
          await transaction.user.update({ where: { id: userId }, data: { active: body.active } });
          if (!body.active) await transaction.userSession.deleteMany({ where: { userId } });
        }
        if (body.roleCode) {
          const selectedRole = await transaction.role.findUnique({ where: { code: body.roleCode } });
          if (!selectedRole) throw new Error("El rol seleccionado no existe.");
          await transaction.userRole.deleteMany({ where: { userId } });
          await transaction.userRole.create({ data: { userId, roleId: selectedRole.id } });
        }
      });
      json(response, 200, { ok: true });
      return;
    }
    const passwordAdminMatch = requestUrl.pathname.match(/^\/api\/admin\/users\/([0-9a-f-]+)\/temporary-password$/i);
    if (request.method === "POST" && passwordAdminMatch) {
      const admin = await requireUser(request);
      if (!isAdmin(admin)) { json(response, 403, { error: "Acceso exclusivo del administrador." }); return; }
      const userId = z.string().uuid().parse(passwordAdminMatch[1]);
      const body = z.object({ password: z.string().min(8).max(200).optional() }).parse(await readJsonBody(request));
      const temporaryPassword = body.password || randomBytes(9).toString("base64url");
      await database.user.update({
        where: { id: userId },
        data: { passwordHash: passwordHash(temporaryPassword), mustChangePassword: true, active: true },
      });
      await database.userSession.deleteMany({ where: { userId } });
      json(response, 200, { ok: true, temporaryPassword });
      return;
    }
    if (request.method === "POST" && requestUrl.pathname === "/api/admin/instructions") {
      const admin = await requireUser(request);
      if (!isAdmin(admin)) { json(response, 403, { error: "Acceso exclusivo del administrador." }); return; }
      const body = z.object({
        key: z.string().trim().min(1).max(100), title: z.string().trim().min(1).max(200),
        content: z.string().trim().min(20).max(200_000), activate: z.boolean().default(true),
        impactChecksum: z.string().length(64),
        conflictResolution: z.string().trim().max(5000).default(""),
      }).merge(contextScopeSchema).parse(await readJsonBody(request));
      const analyzedInput = {
        kind: "SPECIFICATION" as const, key: body.key, title: body.title, content: body.content,
        academicLevels: body.academicLevels, modalities: body.modalities, durations: body.durations,
        subjectTypes: body.subjectTypes, priority: body.priority,
      };
      if (body.impactChecksum !== impactChecksum(analyzedInput)) {
        json(response, 409, { error: "El contenido o el ámbito cambió después del análisis. Analice nuevamente antes de guardar." });
        return;
      }
      const existingForImpact = await database.generationInstruction.findMany({
        where: { status: "ACTIVE" }, select: { title: true, content: true, priority: true },
      });
      const impactAnalysis = analyzeImpactDraft(analyzedInput, existingForImpact);
      if (impactAnalysis.contradictions.length && body.conflictResolution.length < 10) {
        json(response, 409, { error: "Registre la decisión adoptada para las posibles contradicciones antes de guardar." });
        return;
      }
      const latest = await database.generationInstruction.findFirst({ where: { key: body.key }, orderBy: { version: "desc" } });
      const instruction = await database.$transaction(async (transaction) => {
        if (body.activate) await transaction.generationInstruction.updateMany({
          where: { key: body.key, status: "ACTIVE" }, data: { status: "INACTIVE" },
        });
        return transaction.generationInstruction.create({
          data: {
            key: body.key, title: body.title, content: body.content,
            version: (latest?.version ?? 0) + 1, status: body.activate ? "ACTIVE" : "DRAFT",
            academicLevels: body.academicLevels, modalities: body.modalities,
            durations: body.durations, subjectTypes: body.subjectTypes, priority: body.priority,
            impactAnalysis: { ...impactAnalysis, conflictResolution: body.conflictResolution || null },
            impactChecksum: body.impactChecksum,
            activatedAt: body.activate ? new Date() : null, createdById: admin.id,
          },
        });
      });
      json(response, 201, { ok: true, instruction });
      return;
    }
    if (request.method === "POST" && requestUrl.pathname === "/api/admin/ai-impact-analysis") {
      const admin = await requireUser(request);
      if (!isAdmin(admin)) { json(response, 403, { error: "Acceso exclusivo del administrador." }); return; }
      const body = z.object({
        kind: z.enum(["SPECIFICATION", "DOCUMENT"]),
        key: z.string().trim().min(1).max(100),
        title: z.string().trim().min(1).max(200),
        content: z.string().trim().min(20).max(500_000),
        appliesToAll: z.boolean().optional(),
      }).merge(contextScopeSchema).parse(await readJsonBody(request));
      const existing = body.kind === "SPECIFICATION"
        ? await database.generationInstruction.findMany({
            where: { status: "ACTIVE" }, select: { title: true, content: true, priority: true },
          })
        : await database.knowledgeDocument.findMany({
            where: { status: "ACTIVE", key: { not: "indicadores-generales" } },
            select: { title: true, contentMarkdown: true, priority: true },
          }).then((items) => items.map((item) => ({
            title: item.title, content: item.contentMarkdown || "", priority: item.priority,
          })));
      const analyzedInput = {
        kind: body.kind, key: body.key, title: body.title, content: body.content,
        academicLevels: body.academicLevels, modalities: body.modalities,
        durations: body.durations, subjectTypes: body.subjectTypes,
        priority: body.priority, ...(body.kind === "DOCUMENT" ? { appliesToAll: Boolean(body.appliesToAll) } : {}),
      };
      json(response, 200, {
        analysis: analyzeImpactDraft(analyzedInput, existing),
        impactChecksum: impactChecksum(analyzedInput),
      });
      return;
    }
    if (request.method === "POST" && requestUrl.pathname === "/api/admin/knowledge") {
      const admin = await requireUser(request);
      if (!isAdmin(admin)) { json(response, 403, { error: "Acceso exclusivo del administrador." }); return; }
      const body = z.object({
        key: z.string().trim().min(1).max(100), title: z.string().trim().min(1).max(200),
        fileName: z.string().trim().min(1).max(255).optional(),
        mimeType: z.string().trim().min(1).max(150).optional(),
        contentBase64: z.string().max(20_000_000).optional(),
        contentMarkdown: z.string().trim().min(1).max(500_000),
        priority: z.number().int().min(1).max(999).default(100),
        activate: z.boolean().default(true),
        appliesToAll: z.boolean().default(true),
        impactChecksum: z.string().length(64),
        conflictResolution: z.string().trim().max(5000).default(""),
      }).merge(contextScopeSchema.omit({ priority: true })).parse(await readJsonBody(request));
      const analyzedInput = {
        kind: "DOCUMENT" as const, key: body.key, title: body.title, content: body.contentMarkdown,
        academicLevels: body.academicLevels, modalities: body.modalities, durations: body.durations,
        subjectTypes: body.subjectTypes, priority: body.priority, appliesToAll: body.appliesToAll,
      };
      if (body.impactChecksum !== impactChecksum(analyzedInput)) {
        json(response, 409, { error: "El contenido o el ámbito cambió después del análisis. Analice nuevamente antes de guardar." });
        return;
      }
      const existingForImpact = await database.knowledgeDocument.findMany({
        where: { status: "ACTIVE", key: { not: "indicadores-generales" } },
        select: { title: true, contentMarkdown: true, priority: true },
      });
      const impactAnalysis = analyzeImpactDraft(analyzedInput, existingForImpact.map((item) => ({
        title: item.title, content: item.contentMarkdown || "", priority: item.priority,
      })));
      if (impactAnalysis.contradictions.length && body.conflictResolution.length < 10) {
        json(response, 409, { error: "Registre la decisión adoptada para las posibles contradicciones antes de guardar." });
        return;
      }
      if (body.key === "indicadores-generales") {
        json(response, 409, {
          error: "Los indicadores se administran únicamente en «Indicadores generales de la guía».",
        });
        return;
      }
      const latest = await database.knowledgeDocument.findFirst({ where: { key: body.key }, orderBy: { version: "desc" } });
      const version = (latest?.version ?? 0) + 1;
      const fileName = body.fileName || `${body.key}.md`;
      const mimeType = body.mimeType || "text/markdown";
      const bytes = body.contentBase64
        ? Buffer.from(body.contentBase64, "base64")
        : Buffer.from(body.contentMarkdown, "utf8");
      const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
      const relativePath = `knowledge/uploads/${body.key.replace(/[^a-zA-Z0-9_-]/g, "_")}-v${version}-${safeName}`;
      const fileUrl = new URL(`../${relativePath}`, import.meta.url);
      await mkdir(new URL("../knowledge/uploads/", import.meta.url), { recursive: true });
      await writeFile(fileUrl, bytes);
      const document = await database.$transaction(async (transaction) => {
        if (body.activate) await transaction.knowledgeDocument.updateMany({
          where: { key: body.key, status: "ACTIVE" }, data: { status: "INACTIVE" },
        });
        return transaction.knowledgeDocument.create({
          data: {
            key: body.key, title: body.title, version,
            status: body.activate ? "ACTIVE" : "DRAFT", storagePath: relativePath,
            mimeType,
            originalName: fileName,
            contentMarkdown: body.contentMarkdown,
            priority: body.priority,
            academicLevels: body.academicLevels, modalities: body.modalities,
            durations: body.durations, subjectTypes: body.subjectTypes,
            appliesToAll: body.appliesToAll,
            impactAnalysis: { ...impactAnalysis, conflictResolution: body.conflictResolution || null },
            impactChecksum: body.impactChecksum,
            checksum: createHash("sha256").update(bytes).digest("hex"),
            activatedAt: body.activate ? new Date() : null, createdById: admin.id,
          },
        });
      });
      json(response, 201, { ok: true, document });
      return;
    }
    const knowledgeAdminMatch = requestUrl.pathname.match(/^\/api\/admin\/knowledge\/([0-9a-f-]+)$/i);
    if (request.method === "GET" && knowledgeAdminMatch) {
      const admin = await requireUser(request);
      if (!isAdmin(admin)) { json(response, 403, { error: "Acceso exclusivo del administrador." }); return; }
      const id = z.string().uuid().parse(knowledgeAdminMatch[1]);
      const document = await database.knowledgeDocument.findUniqueOrThrow({ where: { id } });
      let contentMarkdown = document.contentMarkdown || "";
      if (!contentMarkdown && ["text/plain", "text/markdown"].includes(document.mimeType)) {
        contentMarkdown = await readFile(new URL(`../${document.storagePath}`, import.meta.url), "utf8");
      }
      json(response, 200, { document: { ...document, contentMarkdown } });
      return;
    }
    const knowledgeDownloadMatch = requestUrl.pathname.match(/^\/api\/admin\/knowledge\/([0-9a-f-]+)\/download$/i);
    if (request.method === "GET" && knowledgeDownloadMatch) {
      const admin = await requireUser(request);
      if (!isAdmin(admin)) { json(response, 403, { error: "Acceso exclusivo del administrador." }); return; }
      const id = z.string().uuid().parse(knowledgeDownloadMatch[1]);
      const document = await database.knowledgeDocument.findUniqueOrThrow({ where: { id } });
      const bytes = await readFile(new URL(`../${document.storagePath}`, import.meta.url));
      const name = (document.originalName || `${document.key}.md`).replace(/["\r\n]/g, "_");
      response.writeHead(200, {
        "Content-Type": document.mimeType,
        "Content-Disposition": `attachment; filename="${name}"`,
        "Content-Length": String(bytes.length),
      });
      response.end(bytes);
      return;
    }
    const knowledgeActivateMatch = requestUrl.pathname.match(/^\/api\/admin\/knowledge\/([0-9a-f-]+)\/activate$/i);
    if (request.method === "POST" && knowledgeActivateMatch) {
      const admin = await requireUser(request);
      if (!isAdmin(admin)) { json(response, 403, { error: "Acceso exclusivo del administrador." }); return; }
      const id = z.string().uuid().parse(knowledgeActivateMatch[1]);
      const selected = await database.knowledgeDocument.findUniqueOrThrow({ where: { id } });
      if (selected.key === "indicadores-generales") {
        json(response, 409, {
          error: "Esta fuente fue archivada. Active una versión desde «Indicadores generales de la guía».",
        });
        return;
      }
      await database.$transaction([
        database.knowledgeDocument.updateMany({
          where: { key: selected.key, status: "ACTIVE" },
          data: { status: "INACTIVE" },
        }),
        database.knowledgeDocument.update({
          where: { id }, data: { status: "ACTIVE", activatedAt: new Date() },
        }),
      ]);
      json(response, 200, { ok: true });
      return;
    }
    if (request.method === "POST" && requestUrl.pathname === "/api/admin/users/bulk") {
      const admin = await requireUser(request);
      if (!isAdmin(admin)) { json(response, 403, { error: "Acceso exclusivo del administrador." }); return; }
      const body = z.object({ users: z.array(z.object({
        firstName: z.string().trim().min(2),
        lastName: z.string().trim().min(2),
        nationalId: z.string().trim().min(6),
        email: z.string().trim().email().transform((value) => value.toLowerCase()),
        role: z.string().trim().min(1).default("TEACHER"),
      })).min(1).max(1000) }).parse(await readJsonBody(request));
      const roles = await database.role.findMany();
      const roleByCode = new Map(roles.map((role) => [role.code, role]));
      const temporaryPasswords: Array<{ email: string; temporaryPassword: string }> = [];
      await database.$transaction(async (transaction) => {
        for (const entry of body.users) {
          const temporaryPassword = randomBytes(9).toString("base64url");
          const user = await transaction.user.upsert({
            where: { email: entry.email },
            update: {
              firstName: entry.firstName, lastName: entry.lastName,
              nationalId: entry.nationalId,
              displayName: `${entry.firstName} ${entry.lastName}`, active: true,
            },
            create: {
              firstName: entry.firstName, lastName: entry.lastName,
              nationalId: entry.nationalId, email: entry.email,
              displayName: `${entry.firstName} ${entry.lastName}`,
              passwordHash: passwordHash(temporaryPassword), mustChangePassword: true,
            },
          });
          const role = roleByCode.get(entry.role);
          if (!role) throw new Error(`No existe el rol ${entry.role}.`);
          await transaction.userRole.deleteMany({ where: { userId: user.id } });
          await transaction.userRole.create({ data: { userId: user.id, roleId: role.id } });
          temporaryPasswords.push({ email: entry.email, temporaryPassword });
        }
      });
      json(response, 201, { ok: true, created: temporaryPasswords.length, temporaryPasswords });
      return;
    }
    if (request.method === "POST" && requestUrl.pathname === "/api/admin/users/bulk-file") {
      const admin = await requireUser(request);
      if (!isAdmin(admin)) { json(response, 403, { error: "Acceso exclusivo del administrador." }); return; }
      const body = z.object({
        fileName: z.string().trim().regex(/\.(xlsx|csv)$/i),
        contentBase64: z.string().min(1).max(20_000_000),
      }).parse(await readJsonBody(request));
      const workbook = XLSX.read(Buffer.from(body.contentBase64, "base64"), { type: "buffer" });
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) throw new Error("El archivo no contiene hojas.");
      const sheet = workbook.Sheets[firstSheetName];
      if (!sheet) throw new Error("No fue posible leer la primera hoja.");
      const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
      const normalized = rawRows.map((row) => {
        const lookup = new Map(Object.entries(row).map(([key, value]) => [key.trim().toLowerCase(), String(value).trim()]));
        return {
          firstName: lookup.get("nombre") || "",
          lastName: lookup.get("apellido") || "",
          nationalId: lookup.get("cédula") || lookup.get("cedula") || "",
          email: (lookup.get("correo") || lookup.get("email") || "").toLowerCase(),
          role: (lookup.get("rol") || lookup.get("role") || "TEACHER").toUpperCase(),
        };
      });
      const users = z.array(z.object({
        firstName: z.string().min(2), lastName: z.string().min(2),
        nationalId: z.string().min(6), email: z.string().email(), role: z.string().min(1),
      })).min(1).max(1000).parse(normalized);
      const roles = await database.role.findMany();
      const roleByCode = new Map(roles.map((role) => [role.code, role]));
      const temporaryPasswords: Array<{ email: string; temporaryPassword: string }> = [];
      await database.$transaction(async (transaction) => {
        for (const entry of users) {
          const role = roleByCode.get(entry.role);
          if (!role) throw new Error(`No existe el rol ${entry.role}.`);
          const temporaryPassword = randomBytes(9).toString("base64url");
          const user = await transaction.user.upsert({
            where: { email: entry.email },
            update: {
              firstName: entry.firstName, lastName: entry.lastName, nationalId: entry.nationalId,
              displayName: `${entry.firstName} ${entry.lastName}`, active: true,
            },
            create: {
              firstName: entry.firstName, lastName: entry.lastName, nationalId: entry.nationalId,
              email: entry.email, displayName: `${entry.firstName} ${entry.lastName}`,
              passwordHash: passwordHash(temporaryPassword), mustChangePassword: true,
            },
          });
          await transaction.userRole.deleteMany({ where: { userId: user.id } });
          await transaction.userRole.create({ data: { userId: user.id, roleId: role.id } });
          temporaryPasswords.push({ email: entry.email, temporaryPassword });
        }
      });
      json(response, 201, { ok: true, created: temporaryPasswords.length, temporaryPasswords });
      return;
    }
    if (request.method === "POST" && requestUrl.pathname === "/api/admin/assignments") {
      const admin = await requireUser(request);
      if (!isAdmin(admin)) { json(response, 403, { error: "Acceso exclusivo del administrador." }); return; }
      const body = z.object({
        teacherId: z.string().uuid(), courseId: z.string().min(1),
        subjectCode: z.string().trim().optional(), subjectName: z.string().trim().optional(),
        career: z.string().trim().min(1), periodId: z.string().uuid(),
        sourceProjectId: z.string().uuid().optional(),
      }).parse(await readJsonBody(request));
      const result = await database.$transaction(async (transaction) => {
        const course = body.courseId === "NEW"
          ? await transaction.course.create({
              data: {
                code: z.string().trim().min(1).parse(body.subjectCode),
                name: z.string().trim().min(1).parse(body.subjectName),
                career: body.career,
              },
            })
          : await transaction.course.findUniqueOrThrow({ where: { id: z.string().uuid().parse(body.courseId) } });
        if (course.career !== body.career) throw new Error("La asignatura no pertenece a la carrera seleccionada.");
        const period = await transaction.academicPeriod.findUniqueOrThrow({ where: { id: body.periodId } });
        const assignment = await transaction.teachingAssignment.upsert({
          where: { teacherId_courseId_periodId: {
            teacherId: body.teacherId, courseId: course.id, periodId: period.id,
          } },
          update: { active: true },
          create: { teacherId: body.teacherId, courseId: course.id, periodId: period.id },
        });
        let clonedProjectId: string | null = null;
        if (body.sourceProjectId) {
          const source = await transaction.project.findUnique({
            where: { id: body.sourceProjectId },
            include: { matrix: { include: { rows: true } }, weeks: true },
          });
          if (!source || source.status !== "COMPLETED") throw new Error("La guía base debe existir y estar finalizada.");
          const teacher = await transaction.user.findUniqueOrThrow({ where: { id: body.teacherId } });
          const copy = await transaction.project.create({
            data: {
              ownerId: body.teacherId, teachingAssignmentId: assignment.id,
              sourceProjectId: source.id, name: `${source.name} – ${period.name}`,
              level: source.level, faculty: source.faculty, career: body.career,
              professorName: teacher.displayName, subjectCode: course.code,
              subjectName: course.name, modality: source.modality,
              academicPeriod: period.name, totalWeeks: source.totalWeeks,
              currentWeek: 1, basicBib: source.basicBib,
              complementaryBib: source.complementaryBib, reaBib: source.reaBib,
              professionalProfileCompetencies: source.professionalProfileCompetencies,
              graduateProfileResults: source.graduateProfileResults,
              utplGenericCompetencies: source.utplGenericCompetencies,
              status: "DRAFT",
              matrix: source.matrix ? { create: {
                originalName: source.matrix.originalName,
                rows: { create: source.matrix.rows.map((row) => ({
                  rowOrder: row.rowOrder, weekNumber: row.weekNumber,
                  learningOutcome: row.learningOutcome, unitContent: row.unitContent,
                  methodology: row.methodology,
                })) },
              } } : undefined,
              weeks: { create: source.weeks.map((week) => ({
                weekNumber: week.weekNumber, status: "PENDING",
                draftContent: week.approvedContent ?? week.draftContent,
                approvedContent: null, approvedAt: null, currentVersion: 0,
              })) },
            },
          });
          clonedProjectId = copy.id;
        } else {
          const teacher = await transaction.user.findUniqueOrThrow({ where: { id: body.teacherId } });
          const assigned = await transaction.project.create({
            data: {
              ownerId: body.teacherId, teachingAssignmentId: assignment.id,
              name: `${course.name} – ${period.name}`, level: "", faculty: "",
              career: course.career, professorName: teacher.displayName,
              subjectCode: course.code, subjectName: course.name, modality: "",
              academicPeriod: period.name, totalWeeks: 8, currentWeek: 1,
              basicBib: "", complementaryBib: "", status: "DRAFT",
            },
          });
          clonedProjectId = assigned.id;
        }
        return { assignmentId: assignment.id, clonedProjectId };
      });
      json(response, 201, { ok: true, ...result });
      return;
    }
    if (request.method === "POST" && requestUrl.pathname === "/api/admin/indicator-versions") {
      const admin = await requireUser(request);
      if (!isAdmin(admin)) { json(response, 403, { error: "Acceso exclusivo del administrador." }); return; }
      const body = z.object({
        title: z.string().trim().min(3).max(200),
        activate: z.boolean().default(true),
        indicators: z.array(z.object({
          code: z.string().trim().min(1).max(50),
          name: z.string().trim().min(3).max(250),
          description: z.string().trim().min(3).max(2000),
          stage: z.enum(["PEER", "QUALITY", "DIITEP"]),
          score: z.number().positive().max(100),
          active: z.boolean().default(true),
          required: z.boolean().default(true),
        })).min(1).max(200),
      }).parse(await readJsonBody(request));
      const latest = await database.indicatorVersion.findFirst({ orderBy: { version: "desc" } });
      const indicatorVersion = await database.$transaction(async (transaction) => {
        if (body.activate) await transaction.indicatorVersion.updateMany({ where: { status: "ACTIVE" }, data: { status: "INACTIVE" } });
        return transaction.indicatorVersion.create({
          data: {
            version: (latest?.version ?? 0) + 1, title: body.title,
            status: body.activate ? "ACTIVE" : "DRAFT", activatedAt: body.activate ? new Date() : null,
            createdById: admin.id,
            indicators: { create: normalizedIndicators(body.indicators).map((item, sortOrder) => ({ ...item, sortOrder })) },
          },
          include: { indicators: { orderBy: { sortOrder: "asc" } } },
        });
      });
      json(response, 201, { ok: true, indicatorVersion });
      return;
    }
    const indicatorMutationMatch = requestUrl.pathname.match(/^\/api\/admin\/indicators(?:\/([0-9a-f-]+))?$/i);
    if (indicatorMutationMatch && ["POST", "PATCH", "DELETE"].includes(request.method ?? "")) {
      const admin = await requireUser(request);
      if (!isAdmin(admin)) { json(response, 403, { error: "Acceso exclusivo del administrador." }); return; }
      const activeVersion = await database.indicatorVersion.findFirst({
        where: { status: "ACTIVE" }, orderBy: { version: "desc" },
        include: { indicators: { orderBy: { sortOrder: "asc" } } },
      });
      if (!activeVersion) throw new Error("No existe una versión activa de indicadores.");
      const targetId = indicatorMutationMatch[1];
      const body = request.method === "DELETE" ? null : z.object({
        name: z.string().trim().min(3).max(250),
        description: z.string().trim().min(3).max(2000),
        stage: z.enum(["PEER", "QUALITY", "DIITEP"]),
        score: z.number().positive().max(100),
        active: z.boolean().optional(),
      }).parse(await readJsonBody(request));
      let next = activeVersion.indicators.map((item) => ({
        code: item.code, name: item.name || item.code, description: item.description,
        stage: item.stage, score: Number(item.score), active: item.active, required: item.required,
      }));
      if (request.method === "POST" && body) {
        const prefix = body.stage === "PEER" ? "PA" : body.stage === "QUALITY" ? "EC" : "DT";
        const used = next.filter((item) => item.code.startsWith(`${prefix}-`))
          .map((item) => Number(item.code.split("-")[1])).filter(Number.isFinite);
        next.push({ code: `${prefix}-${String(Math.max(0, ...used) + 1).padStart(2, "0")}`, ...body, active: true, required: true });
      } else {
        const target = activeVersion.indicators.find((item) => item.id === targetId);
        const index = next.findIndex((item) => item.code === target?.code);
        if (index < 0) throw Object.assign(new Error("Indicador no encontrado."), { statusCode: 404 });
        if (request.method === "PATCH" && body) {
          const current = next[index]!;
          next[index] = { ...current, ...body, code: current.code, required: current.required, active: body.active ?? current.active };
        }
        if (request.method === "DELETE") next.splice(index, 1);
      }
      for (const stage of Object.keys(stageTotals) as Array<keyof typeof stageTotals>) {
        if (!next.some((item) => item.stage === stage && item.active)) {
          throw new Error("Cada responsable debe conservar al menos un indicador activo.");
        }
      }
      const latest = await database.indicatorVersion.findFirst({ orderBy: { version: "desc" } });
      const version = await database.$transaction(async (transaction) => {
        await transaction.indicatorVersion.updateMany({ where: { status: "ACTIVE" }, data: { status: "INACTIVE" } });
        return transaction.indicatorVersion.create({
          data: {
            version: (latest?.version ?? 0) + 1, title: activeVersion.title, status: "ACTIVE",
            activatedAt: new Date(), createdById: admin.id,
            indicators: { create: normalizedIndicators(next).map((item, sortOrder) => ({ ...item, sortOrder })) },
          },
          include: { indicators: { orderBy: { sortOrder: "asc" } } },
        });
      });
      json(response, 200, { ok: true, indicatorVersion: version });
      return;
    }
    const checklistProjectMatch = requestUrl.pathname.match(/^\/api\/admin\/projects\/([0-9a-f-]+)\/checklist$/i);
    if (request.method === "GET" && checklistProjectMatch) {
      const reviewer = await requireUser(request);
      const projectId = z.string().uuid().parse(checklistProjectMatch[1]);
      const stage = z.enum(["PEER", "QUALITY", "DIITEP"]).parse(requestUrl.searchParams.get("stage"));
      if (!canReview(reviewer, stage)) { json(response, 403, { error: "No tiene permisos para evaluar esta etapa." }); return; }
      let review = await database.guideReview.findUnique({
        where: { projectId_stage: { projectId, stage } },
        include: { items: { include: { indicator: true }, orderBy: { indicator: { sortOrder: "asc" } } }, indicatorVersion: true },
      });
      if (!review) {
        const version = await database.indicatorVersion.findFirst({
          where: { status: "ACTIVE" }, orderBy: { version: "desc" }, include: { indicators: true },
        });
        if (!version) throw new Error("Debe activar una versión de indicadores antes de iniciar la revisión.");
        const stageIndicators = version.indicators.filter((indicator) => indicator.active && indicator.stage === stage);
        if (!stageIndicators.length) throw new Error("No existen indicadores activos para esta etapa.");
        review = await database.guideReview.create({
          data: {
            projectId, stage, indicatorVersionId: version.id,
            items: { create: stageIndicators.map((indicator) => ({ indicatorId: indicator.id })) },
          },
          include: { items: { include: { indicator: true }, orderBy: { indicator: { sortOrder: "asc" } } }, indicatorVersion: true },
        });
      }
      const possible = review.items.filter((item) => item.result !== "NOT_APPLICABLE")
        .reduce((sum, item) => sum + Number(item.indicator.score), 0);
      const earned = review.items.reduce((sum, item) => sum + Number(item.indicator.score)
        * (item.result === "COMPLIES" ? 1 : item.result === "COMPLIES_PARTIALLY" ? 0.5 : 0), 0);
      const percentage = possible > 0 ? earned / possible * 100 : 0;
      json(response, 200, { review, scoring: { earned, possible, percentage, category: categoryFor(percentage) } });
      return;
    }
    const checklistMatch = requestUrl.pathname.match(/^\/api\/admin\/checklists\/([0-9a-f-]+)$/i);
    if (request.method === "PATCH" && checklistMatch) {
      const reviewer = await requireUser(request);
      const reviewId = z.string().uuid().parse(checklistMatch[1]);
      const body = z.object({
        decision: z.enum(["DRAFT", "APPROVED", "CHANGES_REQUESTED"]),
        generalObservation: z.string().trim().max(10_000).optional().default(""),
        items: z.array(z.object({
          id: z.string().uuid(), result: z.enum(["PENDING", "COMPLIES", "COMPLIES_PARTIALLY", "DOES_NOT_COMPLY", "NOT_APPLICABLE"]),
          observation: z.string().trim().max(5000).optional().default(""),
        })).min(1),
      }).parse(await readJsonBody(request));
      const review = await database.guideReview.findUniqueOrThrow({
        where: { id: reviewId }, include: { items: { include: { indicator: true } } },
      });
      if (!canReview(reviewer, review.stage)) { json(response, 403, { error: "No tiene permisos para evaluar esta etapa." }); return; }
      const submitted = new Map(body.items.map((item) => [item.id, item]));
      if (review.items.some((item) => !submitted.has(item.id))) throw new Error("La lista de cotejo está incompleta.");
      if (body.decision === "APPROVED" && review.items.some((item) => {
        const result = submitted.get(item.id)?.result;
        return item.indicator.required ? result === "PENDING" || result === "DOES_NOT_COMPLY" : result === "PENDING";
      })) throw new Error("No se puede aprobar: existen indicadores obligatorios pendientes o incumplidos.");
      const scoredItems = review.items.map((item) => ({ ...item, submittedResult: submitted.get(item.id)?.result ?? "PENDING" }));
      const possibleScore = scoredItems.filter((item) => item.submittedResult !== "NOT_APPLICABLE")
        .reduce((sum, item) => sum + Number(item.indicator.score), 0);
      const earnedScore = scoredItems.reduce((sum, item) => sum + Number(item.indicator.score)
        * (item.submittedResult === "COMPLIES" ? 1 : item.submittedResult === "COMPLIES_PARTIALLY" ? 0.5 : 0), 0);
      const percentage = possibleScore > 0 ? earnedScore / possibleScore * 100 : 0;
      const category = categoryFor(percentage);
      if (body.decision === "APPROVED" && percentage < 80) {
        throw new Error(`No se puede aprobar: la guía obtuvo ${percentage.toFixed(2)} % (${category}).`);
      }
      await database.$transaction(async (transaction) => {
        for (const item of body.items) await transaction.guideReviewItem.update({
          where: { id: item.id }, data: { result: item.result, observation: item.observation || null },
        });
        await transaction.guideReview.update({
          where: { id: reviewId },
          data: {
            decision: body.decision, generalObservation: body.generalObservation || null,
            reviewedById: reviewer.id, reviewedAt: body.decision === "DRAFT" ? null : new Date(),
            earnedScore, possibleScore, percentage, category,
          },
        });
      });
      json(response, 200, { ok: true, scoring: { earned: earnedScore, possible: possibleScore, percentage, category } });
      return;
    }
    if (request.method === "GET" && requestUrl.pathname === "/api/projects") {
      const user = await requireUser(request);
      const search = requestUrl.searchParams.get("search")?.trim() ?? "";
      const projects = await database.project.findMany({
        where: {
          ownerId: user.id,
          status: { not: "ARCHIVED" },
          ...(search ? {
            OR: [
              { professorName: { contains: search, mode: "insensitive" } },
              { subjectName: { contains: search, mode: "insensitive" } },
              { subjectCode: { contains: search, mode: "insensitive" } },
            ],
          } : {}),
        },
        orderBy: { updatedAt: "desc" },
        include: { weeks: { select: { status: true } } },
      });
      response.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      });
      response.end(JSON.stringify({
        projects: projects.map((project) => ({
          projectId: project.id,
          projectName: project.name,
          professorName: project.professorName,
          subjectCode: project.subjectCode,
          subjectName: project.subjectName,
          career: project.career,
          status: project.status,
          totalWeeks: project.totalWeeks,
          approvedWeeks: project.weeks.filter((week) => week.status === "APPROVED").length,
          updatedAt: project.updatedAt.toISOString(),
        })),
      }));
      return;
    }
    const canonicalGuideMatch = requestUrl.pathname.match(
      /^\/api\/projects\/([0-9a-f-]+)\/canonical-json$/i,
    );
    if (request.method === "GET" && canonicalGuideMatch) {
      const user = await requireUser(request);
      const project = await database.project.findFirst({
        where: {
          id: canonicalGuideMatch[1],
          ownerId: user.id,
          status: { not: "ARCHIVED" },
        },
        include: { canonicalGuide: true },
      });
      if (!project) {
        json(response, 404, { error: "La guía no existe o no pertenece al usuario." });
        return;
      }
      if (!project.canonicalGuide) {
        json(response, 409, {
          error: "El JSON canónico todavía no se ha creado. Guarde nuevamente el proyecto o ejecute la conversión inicial.",
        });
        return;
      }
      const validation = canonicalGuideDocumentSchema.safeParse(project.canonicalGuide.document);
      if (!validation.success) {
        json(response, 500, {
          error: "El JSON canónico almacenado no cumple el contrato vigente.",
          details: validation.error.flatten(),
        });
        return;
      }
      if (validation.data.schemaVersion !== project.canonicalGuide.schemaVersion) {
        json(response, 500, {
          error: "La versión almacenada no coincide con la declarada por el documento canónico.",
        });
        return;
      }
      const serialized = `${JSON.stringify(validation.data, null, 2)}\n`;
      response.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${canonicalDownloadName(project.subjectName, project.canonicalGuide.schemaVersion)}"`,
        "Content-Length": Buffer.byteLength(serialized),
        "Cache-Control": "no-store",
        "X-Canonical-Schema-Version": project.canonicalGuide.schemaVersion,
        "X-Content-SHA256": project.canonicalGuide.checksum,
      });
      response.end(serialized);
      return;
    }
    const projectMatch = requestUrl.pathname.match(/^\/api\/projects\/([0-9a-f-]+)$/i);
    if (request.method === "GET" && projectMatch) {
      const user = await requireUser(request);
      const project = await database.project.findFirst({
        where: { id: projectMatch[1], ownerId: user.id, status: { not: "ARCHIVED" } },
        include: {
          matrix: { include: { rows: { orderBy: { rowOrder: "asc" } } } },
          weeks: { orderBy: { weekNumber: "asc" } },
        },
      });
      response.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      });
      if (!project) {
        response.end(JSON.stringify({ project: null }));
        return;
      }
      response.end(JSON.stringify({
        project: {
          projectId: project.id,
          currentWeek: project.currentWeek,
          formData: {
            projectName: project.name,
            level: project.level,
            faculty: project.faculty,
            career: project.career,
            professorName: user.displayName,
            subjectCode: project.subjectCode,
            subjectName: project.subjectName,
            subjectType: project.subjectType,
            modality: project.modality,
            academicPeriod: project.academicPeriod,
            weeks: project.totalWeeks,
            professionalProfileCompetencies: project.professionalProfileCompetencies,
            graduateProfileResults: project.graduateProfileResults,
            utplGenericCompetencies: project.utplGenericCompetencies,
            basic: project.basicBib,
            complementary: project.complementaryBib,
            rea: project.reaBib ?? "",
          },
          matrixFileName: project.matrix?.originalName ?? "",
          matrixRows: (project.matrix?.rows ?? []).map((row) => ({
            Semana: String(row.weekNumber),
            "Resultado de aprendizaje": row.learningOutcome,
            "Unidad/Contenido": row.unitContent,
            Metodología: row.methodology,
          })),
          weekStates: Object.fromEntries(project.weeks.map((week) => [
            String(week.weekNumber),
            {
              status: browserWeekStatus(week.status),
              draftContent: week.draftContent ?? "",
              approvedContent: week.approvedContent ?? "",
              approvedAt: week.approvedAt?.toISOString(),
              version: week.currentVersion,
            },
          ])),
        },
      }));
      return;
    }
    if (
      request.method === "POST" &&
      requestUrl.pathname === "/api/projects/sync"
    ) {
      const body = projectPersistenceSchema.parse(await readJsonBody(request));
      const user = await requireUser(request);
      const saved = await database.$transaction(async (transaction) => {
        const project = body.projectId
          ? await transaction.project.update({
              where: { id: body.projectId, ownerId: user.id },
              data: {
                name: body.project.projectName,
                level: body.project.level,
                faculty: body.project.faculty,
                career: body.project.career,
                professorName: user.displayName,
                subjectCode: body.project.subjectCode,
                subjectName: body.project.subjectName,
                subjectType: body.project.subjectType,
                modality: body.project.modality,
                academicPeriod: body.project.academicPeriod,
                totalWeeks: body.project.weeks,
                currentWeek: body.currentWeek,
                basicBib: body.bibliography.basic,
                complementaryBib: body.bibliography.complementary,
                reaBib: body.bibliography.rea,
                professionalProfileCompetencies: body.project.professionalProfileCompetencies,
                graduateProfileResults: body.project.graduateProfileResults,
                utplGenericCompetencies: body.project.utplGenericCompetencies,
                status: Object.values(body.weekStates).filter((week) => week.status === "approved").length === body.project.weeks
                  ? "COMPLETED"
                  : "IN_PROGRESS",
              },
            })
          : await transaction.project.create({
              data: {
                ownerId: user.id,
                name: body.project.projectName,
                level: body.project.level,
                faculty: body.project.faculty,
                career: body.project.career,
                professorName: user.displayName,
                subjectCode: body.project.subjectCode,
                subjectName: body.project.subjectName,
                subjectType: body.project.subjectType,
                modality: body.project.modality,
                academicPeriod: body.project.academicPeriod,
                totalWeeks: body.project.weeks,
                currentWeek: body.currentWeek,
                basicBib: body.bibliography.basic,
                complementaryBib: body.bibliography.complementary,
                reaBib: body.bibliography.rea,
                professionalProfileCompetencies: body.project.professionalProfileCompetencies,
                graduateProfileResults: body.project.graduateProfileResults,
                utplGenericCompetencies: body.project.utplGenericCompetencies,
                status: Object.values(body.weekStates).filter((week) => week.status === "approved").length === body.project.weeks
                  ? "COMPLETED"
                  : "IN_PROGRESS",
              },
            });
        await transaction.matrix.deleteMany({ where: { projectId: project.id } });
        await transaction.matrix.create({
          data: {
            projectId: project.id,
            originalName: body.matrixFileName || null,
            rows: {
              create: body.matrixRows.map((row, index) => ({
                rowOrder: index + 1,
                weekNumber: Number.parseInt(row.Semana, 10),
                learningOutcome: row["Resultado de aprendizaje"],
                unitContent: row["Unidad/Contenido"],
                methodology: row.Metodología,
              })),
            },
          },
        });
        for (let weekNumber = 1; weekNumber <= body.project.weeks; weekNumber += 1) {
          const state = body.weekStates[String(weekNumber)] ?? {
            status: "pending" as const,
            draftContent: "",
            approvedContent: "",
            version: 0,
          };
          const existing = await transaction.projectWeek.findUnique({
            where: { projectId_weekNumber: { projectId: project.id, weekNumber } },
          });
          const versionChanged =
            state.status === "approved" &&
            state.version > (existing?.currentVersion ?? 0);
          const projectWeek = await transaction.projectWeek.upsert({
            where: { projectId_weekNumber: { projectId: project.id, weekNumber } },
            update: {
              status: databaseWeekStatus(state.status),
              draftContent: state.draftContent,
              approvedContent: state.approvedContent,
              approvedAt: state.approvedAt ? new Date(state.approvedAt) : null,
              currentVersion: state.version,
            },
            create: {
              projectId: project.id,
              weekNumber,
              status: databaseWeekStatus(state.status),
              draftContent: state.draftContent,
              approvedContent: state.approvedContent,
              approvedAt: state.approvedAt ? new Date(state.approvedAt) : null,
              currentVersion: state.version,
            },
          });
          if (versionChanged && state.approvedContent) {
            await transaction.weekVersion.create({
              data: {
                projectWeekId: projectWeek.id,
                versionNumber: state.version,
                status: "APPROVED",
                content: state.approvedContent,
                createdById: user.id,
              },
            });
          }
        }
        const canonicalSource = await transaction.project.findUniqueOrThrow({
          where: { id: project.id },
          include: {
            matrix: { include: { rows: { orderBy: { rowOrder: "asc" } } } },
            weeks: { orderBy: { weekNumber: "asc" } },
            generatedImages: {
              orderBy: [{ weekNumber: "asc" }, { figureNumber: "asc" }],
            },
          },
        });
        const canonicalDocument = buildCanonicalGuide({
          project: canonicalSource,
          matrix: canonicalSource.matrix,
          weeks: canonicalSource.weeks,
          generatedImages: canonicalSource.generatedImages,
        });
        const canonicalChecksum = canonicalDocumentChecksum(canonicalDocument);
        await transaction.canonicalGuideDocument.upsert({
          where: { projectId: project.id },
          update: {
            schemaVersion: CANONICAL_GUIDE_SCHEMA_VERSION,
            document: canonicalDocument as unknown as Prisma.InputJsonValue,
            checksum: canonicalChecksum,
          },
          create: {
            projectId: project.id,
            schemaVersion: CANONICAL_GUIDE_SCHEMA_VERSION,
            document: canonicalDocument as unknown as Prisma.InputJsonValue,
            checksum: canonicalChecksum,
          },
        });
        await transaction.auditLog.create({
          data: {
            userId: user.id,
            action: body.projectId ? "PROJECT_SYNCED" : "PROJECT_CREATED",
            entityType: "Project",
            entityId: project.id,
          },
        });
        return project;
      });
      response.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      });
      response.end(JSON.stringify({
        ok: true,
        projectId: saved.id,
        savedAt: saved.updatedAt.toISOString(),
        canonicalSchemaVersion: CANONICAL_GUIDE_SCHEMA_VERSION,
      }));
      return;
    }
    if (
      request.method === "POST" &&
      requestUrl.pathname === "/api/validate-matrix"
    ) {
      const body = z.object({
        fileName: z.string().trim().regex(/\.(xlsx|csv)$/i),
        content: z.string().min(1).max(14_000_000),
      }).parse(await readJsonBody(request));
      try {
        const rows = await parseMatrix(body.fileName, body.content);
        const weekCount = new Set(rows.map((row) => row.Semana)).size;
        response.writeHead(200, {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store",
        });
        response.end(JSON.stringify({
          valid: true,
          columns: requiredColumns,
          rowCount: rows.length,
          weekCount,
          rows,
        }));
      } catch (error) {
        response.writeHead(400, {
          "Content-Type": "application/json; charset=utf-8",
        });
        response.end(JSON.stringify({
          error: error instanceof Error ? error.message : "La matriz no es válida.",
        }));
      }
      return;
    }
    if (
      request.method === "POST" &&
      requestUrl.pathname === "/api/generate-week"
    ) {
      if (!openai) {
        response.writeHead(503, {
          "Content-Type": "application/json; charset=utf-8",
        });

        response.end(
          JSON.stringify({
            error:
              "La variable OPENAI_API_KEY no está configurada.",
          }),
        );

        return;
      }

      const requestBody = await readJsonBody(request);

      const validation =
        generationRequestSchema.safeParse(requestBody);

      if (!validation.success) {
        response.writeHead(400, {
          "Content-Type": "application/json; charset=utf-8",
        });

        response.end(
          JSON.stringify({
            error:
              "La información enviada está incompleta o no es válida.",
            details: validation.error.flatten(),
          }),
        );

        return;
      }

      const weekRows = validation.data.matrixRows.filter(
        (row) =>
          Number.parseInt(row.Semana, 10) === validation.data.week,
      );
      const matrixWeeks = [
        ...new Set(validation.data.matrixRows.map((row) => Number.parseInt(row.Semana, 10))),
      ].sort((a, b) => a - b);
      const validSequence =
        matrixWeeks.length === validation.data.project.weeks &&
        matrixWeeks.every((week, index) => week === index + 1);
      if (!validSequence || validation.data.week > validation.data.project.weeks) {
        response.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify({
          error: "El número y la secuencia de semanas de la matriz no coinciden con el proyecto.",
        }));
        return;
      }
      const methodologies = [
        ...new Set(weekRows.map((row) => row.Metodología)),
      ].join("\n");

      const generationText = buildGenerationInput(validation.data);
      const inputContent: Array<Record<string, string>> = [
        { type: "input_text", text: generationText },
        ...validation.data.attachments.map((attachment) => ({
          type: "input_file",
          filename: attachment.fileName,
          file_data: `data:${attachment.mimeType};base64,${attachment.content}`,
        })),
      ];

      const administrativeContext = await activeAdministrativeContext({
        level: validation.data.project.level,
        modality: validation.data.project.modality,
        weeks: validation.data.project.weeks,
        subjectType: validation.data.project.subjectType,
      }, validation.data.projectId);
      const apiResponse = await openai.responses.create({
        model: openaiModel,
        instructions: `${buildGenerationInstructions(methodologies)}${administrativeContext ? `\n\n${administrativeContext}` : ""}`,
        input: [{
          role: "user",
          content: inputContent,
        }] as unknown as OpenAI.Responses.ResponseInput,
      });

      const generatedContent =
        apiResponse.output_text.trim();

      if (!generatedContent) {
        throw new Error(
          "OpenAI no devolvió contenido para la semana.",
        );
      }

      const assistedResourceProposals = validation.data.adjustmentInstructions
        ? []
        : await analyzeAssistedResourceOpportunities(
            generatedContent,
            validation.data.project.subjectName,
          );

      response.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      });

      response.end(
        JSON.stringify({
          week: validation.data.week,
          content: generatedContent,
          assistedResourceProposals,
          visualProposals: assistedResourceProposals,
          model: openaiModel,
        }),
      );

      return;
    }
    if (request.method === "POST" && requestUrl.pathname === "/api/generate-visual") {
      if (!openai) {
        response.writeHead(503, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify({ error: "La variable OPENAI_API_KEY no está configurada." }));
        return;
      }
      const body = generateVisualSchema.parse(await readJsonBody(request));
      const style = body.proposal.styles.find((item) => item.id === body.styleId);
      if (!style) {
        response.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify({ error: "Seleccione uno de los estilos propuestos." }));
        return;
      }
      let projectWeekId: string | undefined;
      if (body.projectId) {
        projectWeekId = (await database.projectWeek.findUnique({
          where: { projectId_weekNumber: { projectId: body.projectId, weekNumber: body.week } },
          select: { id: true },
        }))?.id;
      }
      const prompt = `${body.proposal.prompt}

ESTILO SELECCIONADO: ${style.name}. ${style.description}
Propósito educativo: ${body.proposal.purpose}
Texto alternativo previsto: ${body.proposal.altText}
Produzca una composición académica clara, contemporánea, accesible y con alto contraste.
No añada información, cifras, citas, logotipos, marcas de agua, datos personales ni párrafos extensos.`;
      const imageResponse = await openai.images.generate({
        model: openaiImageModel,
        prompt,
        size: "1024x1024",
      });
      const imageBase64 = imageResponse.data?.[0]?.b64_json;
      if (!imageBase64) throw new Error("El servicio no devolvió el archivo visual.");
      const created = await database.generatedImage.create({
        data: {
          projectId: body.projectId,
          projectWeekId,
          weekNumber: body.week,
          figureNumber: body.figureNumber,
          title: body.proposal.title,
          altText: body.proposal.altText,
          source: body.proposal.source,
          prompt,
          style: style.name,
          imageData: Buffer.from(imageBase64, "base64"),
        },
      });
      response.writeHead(201, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      });
      response.end(JSON.stringify({
        id: created.id,
        url: `/api/generated-images/${created.id}`,
        title: created.title,
        altText: created.altText,
        source: created.source,
        figureNumber: created.figureNumber,
      }));
      return;
    }
    if (request.method === "POST" && requestUrl.pathname === "/api/generate-assisted-resource") {
      if (!openai) {
        response.writeHead(503, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify({ error: "La variable OPENAI_API_KEY no está configurada." }));
        return;
      }
      const body = generateAssistedResourceSchema.parse(await readJsonBody(request));
      const style = body.proposal.styles.find((item) => item.id === body.styleId);
      if (!style) {
        response.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify({ error: "Seleccione una de las opciones propuestas." }));
        return;
      }
      const labels = {
        image: "recurso visual",
        video_script: "guion educativo de video",
        genially: "estructura completa y trasladable a Genially",
        storytelling: "storytelling educativo",
      } as const;
      const resourceResponse = await openai.responses.create({
        model: openaiModel,
        instructions: `Actúa como diseñador instruccional y genera exclusivamente un ${labels[body.proposal.kind]} listo para revisión docente.
Devuelve Markdown limpio, sin cercas de código ni comentarios sobre el proceso.
Mantén fidelidad estricta al contenido proporcionado: no inventes datos, citas, autores ni resultados de aprendizaje.
El recurso debe ser autónomo, claro, accesible, editable y adecuado para educación superior.
Para video_script, incluye duración estimada, propósito, escenas en una tabla con tiempo, imagen/acción, locución y texto en pantalla, y cierre.
Para genially, incluye propósito, tipo de plantilla, navegación, pantallas numeradas, contenido breve de cada pantalla, interacción, retroalimentación y recursos necesarios.
Para storytelling, incluye propósito, personajes o voces, contexto, conflicto o pregunta guía, secuencia narrativa, desenlace/reflexión y conexión explícita con el aprendizaje.
Evita actividades calificadas o contenidos ajenos a la planificación.`,
        input: `ASIGNATURA: ${body.proposal.topic}
TIPO: ${labels[body.proposal.kind]}
ENFOQUE SELECCIONADO: ${style.name}. ${style.description}
FINALIDAD: ${body.proposal.purpose}
INSTRUCCIONES DE LA PROPUESTA: ${body.proposal.prompt}
CONTENIDO DE REFERENCIA: ${body.proposal.insertionAfter}`,
      });
      const generatedContent = resourceResponse.output_text.trim();
      if (!generatedContent) throw new Error("El servicio no devolvió el recurso solicitado.");
      response.writeHead(201, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      });
      response.end(JSON.stringify({
        kind: body.proposal.kind,
        title: body.proposal.title,
        content: generatedContent,
      }));
      return;
    }
    const generatedImageMatch = requestUrl.pathname.match(/^\/api\/generated-images\/([0-9a-f-]{36})$/i);
    if (request.method === "GET" && generatedImageMatch) {
      const image = await database.generatedImage.findUnique({ where: { id: generatedImageMatch[1] } });
      if (!image) {
        response.writeHead(404, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify({ error: "La imagen no existe." }));
        return;
      }
      response.writeHead(200, {
        "Content-Type": image.mimeType,
        "Content-Length": image.imageData.length,
        "Cache-Control": "public, max-age=31536000, immutable",
      });
      response.end(Buffer.from(image.imageData));
      return;
    }
    if (
      request.method === "POST" &&
      requestUrl.pathname === "/api/download-word"
    ) {
      const body = wordRequestSchema.parse(await readJsonBody(request));
      const expectedWeeks = body.weeks.map((item) => item.week);
      const consecutive = expectedWeeks.every((week, index) => week === index + 1);
      if (!consecutive) {
        response.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify({ error: "Solo pueden descargarse semanas aprobadas consecutivas desde la semana 1." }));
        return;
      }
      const isComplete = body.weeks.length === body.project.totalWeeks;
      const weekBlocks = await Promise.all(body.weeks.map(async (item) => [
        new Paragraph({ text: `Semana ${item.week}`, heading: HeadingLevel.HEADING_1, pageBreakBefore: item.week > 1 }),
        ...await markdownParagraphsWithImages(item.content),
      ]));
      const document = new Document({
        numbering: {
          config: [{
            reference: "approved-weeks",
            levels: [{ level: 0, format: "decimal", text: "%1.", alignment: "left" }],
          }],
        },
        sections: [{
          children: [
            new Paragraph({ text: body.project.projectName, heading: HeadingLevel.TITLE }),
            new Paragraph({ children: [new TextRun({ text: isComplete ? "Guía didáctica" : `Avance aprobado hasta la semana ${body.weeks.length}`, bold: true })] }),
            new Paragraph(`Asignatura: ${body.project.subjectName}`),
            new Paragraph(`Carrera: ${body.project.career}`),
            new Paragraph(`Modalidad: ${body.project.modality}`),
            new Paragraph(`Periodo académico: ${body.project.academicPeriod}`),
            ...weekBlocks.flat(),
          ],
        }],
      });
      const buffer = await Packer.toBuffer(document);
      const safeName = body.project.subjectName.normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[^a-zA-Z0-9_-]+/g, "-");
      response.writeHead(200, {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${safeName || "guia-didactica"}.docx"`,
        "Content-Length": buffer.length,
        "Cache-Control": "no-store",
      });
      response.end(buffer);
      return;
    }
    if (request.method === "GET" && requestUrl.pathname === "/") {
      const formHtml = await readFile(formFileUrl, "utf8");

      response.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      });

      response.end(formHtml);
      return;
    }
    if (
      request.method === "GET" &&
      requestUrl.pathname === "/app.js"
    ) {
      const appScript = await readFile(
        appScriptFileUrl,
        "utf8",
      );

      response.writeHead(200, {
        "Content-Type": "text/javascript; charset=utf-8",
        "Cache-Control": "no-store",
      });

      response.end(appScript);
      return;
    }

    if (
      request.method === "GET" &&
      requestUrl.pathname === "/academic-offer.js"
    ) {
      const academicOffer = await readFile(
        academicOfferFileUrl,
        "utf8",
      );

      response.writeHead(200, {
        "Content-Type": "text/javascript; charset=utf-8",
        "Cache-Control": "no-store",
      });

      response.end(academicOffer);
      return;
    }

    if (
      request.method === "GET" &&
      requestUrl.pathname === "/styles.css"
    ) {
      const styles = await readFile(
        stylesFileUrl,
        "utf8",
      );

      response.writeHead(200, {
        "Content-Type": "text/css; charset=utf-8",
        "Cache-Control": "no-store",
      });

      response.end(styles);
      return;
    }
    if (
      request.method === "GET" &&
      requestUrl.pathname === "/editor-rich.css"
    ) {
      const editorStyles = await readFile(
        editorStylesFileUrl,
        "utf8",
      );

      response.writeHead(200, {
        "Content-Type": "text/css; charset=utf-8",
        "Cache-Control": "no-store",
      });

      response.end(editorStyles);
      return;
    }
    if (request.method === "GET" && [
      "/schemas/guide-canonical-v1.schema.json",
      "/schemas/guide-canonical-v2.schema.json",
    ].includes(requestUrl.pathname)) {
      const schema = await readFile(
        requestUrl.pathname.endsWith("v1.schema.json")
          ? canonicalGuideV1SchemaFileUrl
          : canonicalGuideV2SchemaFileUrl,
        "utf8",
      );
      response.writeHead(200, {
        "Content-Type": "application/schema+json; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      });
      response.end(schema);
      return;
    }
    if (request.method === "GET" && requestUrl.pathname === "/health") {
      response.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
      });

      response.end(
        JSON.stringify({
          status: "ok",
          server: serverName,
          version: serverVersion,
        }),
      );

      return;
    }

    const supportedMethods = new Set(["POST", "GET", "DELETE"]);

    if (
      requestUrl.pathname === "/mcp" &&
      supportedMethods.has(request.method ?? "")
    ) {
      const mcpServer = createMcpServer();
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
      });

      response.on("close", () => {
        void transport.close();
        void mcpServer.close();
      });

      await mcpServer.connect(transport);

      const body =
        request.method === "POST"
          ? await readJsonBody(request)
          : undefined;

      await transport.handleRequest(request, response, body);
      return;
    }

    response.writeHead(404, {
      "Content-Type": "application/json; charset=utf-8",
    });

    response.end(
      JSON.stringify({
        error: "Ruta no encontrada",
      }),
    );
  } catch (error) {
    console.error("Error al procesar la solicitud:", error);

    if (!response.headersSent) {
      response.writeHead(Number((error as { statusCode?: number }).statusCode ?? 500), {
        "Content-Type": "application/json; charset=utf-8",
      });
    }

    response.end(
      JSON.stringify({
        error: "Error interno del servidor",
      }),
    );
  }
});

httpServer.listen(port, "0.0.0.0", () => {
  console.log(`Servidor disponible en http://localhost:${port}`);
  console.log(`Verificación: http://localhost:${port}/health`);
  console.log(`MCP: http://localhost:${port}/mcp`);
});
