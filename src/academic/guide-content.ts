import { z } from "zod";

export const guideHeadingRoleSchema = z.enum(["unit", "topic", "subtopic"]);
export type GuideHeadingRole = z.infer<typeof guideHeadingRoleSchema>;

export const guideOutlineItemSchema = z.strictObject({
  sourceId: z.string().min(1),
  role: guideHeadingRoleSchema,
  level: z.number().int().min(1).max(3),
  number: z.string().regex(/^\d+(?:\.\d+){0,2}$/),
  text: z.string().min(1),
  literal: z.string().min(1),
  develop: z.boolean(),
});
export type GuideOutlineItem = z.infer<typeof guideOutlineItemSchema>;

const guideTextMarksSchema = z.array(z.enum(["bold", "italic", "underline"])).max(3).default([]);

const guideInlineTextSchema = z.strictObject({
  type: z.literal("text"),
  text: z.string(),
  marks: guideTextMarksSchema,
});

const guideInlineLinkSchema = z.strictObject({
  type: z.literal("link"),
  text: z.string().min(1),
  href: z.string().min(1),
  marks: guideTextMarksSchema,
});

export const guideInlineSchema = z.union([guideInlineTextSchema, guideInlineLinkSchema]);
export type GuideInline = z.infer<typeof guideInlineSchema>;

const guideHeadingBlockSchema = z.strictObject({
  id: z.string().min(1),
  type: z.literal("heading"),
  role: guideHeadingRoleSchema,
  level: z.number().int().min(1).max(3),
  number: z.string().regex(/^\d+(?:\.\d+){0,2}$/),
  text: z.string().min(1),
  sourceId: z.string().min(1),
});

const guideParagraphBlockSchema = z.strictObject({
  id: z.string().min(1),
  type: z.literal("paragraph"),
  content: z.array(guideInlineSchema),
});

const guideListBlockSchema = z.strictObject({
  id: z.string().min(1),
  type: z.literal("list"),
  style: z.enum(["bullet", "ordered"]),
  items: z.array(z.array(guideInlineSchema).min(1)).min(1),
});

const guideTableBlockSchema = z.strictObject({
  id: z.string().min(1),
  type: z.literal("table"),
  caption: z.string().nullable(),
  headers: z.array(z.string()).min(1),
  rows: z.array(z.array(z.string())).min(1),
});

const guideImageBlockSchema = z.strictObject({
  id: z.string().min(1),
  type: z.literal("image"),
  assetId: z.string().uuid().nullable(),
  src: z.string().min(1),
  altText: z.string(),
  caption: z.string().nullable(),
  source: z.string().nullable(),
});

const guideCalloutBlockSchema = z.strictObject({
  id: z.string().min(1),
  type: z.literal("callout"),
  variant: z.enum(["important", "remember", "definition", "example", "reflection", "question", "tip", "warning"]),
  title: z.string().nullable(),
  content: z.array(guideInlineSchema),
});

const guideQuoteBlockSchema = z.strictObject({
  id: z.string().min(1),
  type: z.literal("quote"),
  content: z.array(guideInlineSchema),
  attribution: z.string().nullable(),
});

const guideEducationalResourceBlockSchema = z.strictObject({
  id: z.string().min(1),
  type: z.literal("educational_resource"),
  resourceId: z.string().min(1),
  title: z.string().min(1),
  status: z.enum(["proposed", "teacher_approved", "rejected"]),
});

export const guideBlockSchema = z.union([
  guideHeadingBlockSchema,
  guideParagraphBlockSchema,
  guideListBlockSchema,
  guideTableBlockSchema,
  guideImageBlockSchema,
  guideCalloutBlockSchema,
  guideQuoteBlockSchema,
  guideEducationalResourceBlockSchema,
]);
export type GuideBlock = z.infer<typeof guideBlockSchema>;

export const bloomLevelSchema = z.enum(["RECORDAR", "COMPRENDER", "APLICAR", "ANALIZAR", "EVALUAR", "CREAR"]);
export const educationalResourceTypeSchema = z.enum([
  "DICTADO",
  "SOPA_DE_LETRAS",
  "CRUCIGRAMA",
  "MARCAR_CASILLAS",
  "INFOGRAFIA",
  "IMAGEN_INTERACTIVA",
  "PRESENTACION_INTERACTIVA",
  "COMPLETAR_TEXTO",
  "ARRASTRAR_Y_SOLTAR",
  "UNIR_CON_LINEAS",
  "ROMPECABEZAS",
  "VIDEO_QUIZ",
  "QUIZ",
  "IMAGEN_INTERACTIVA_360",
  "VIDEO_INTERACTIVO",
  "STORYTELLING",
  "SIMULACION",
  "GAMIFICACION",
  "MODULO_DIDACTICO",
  "REALIDAD_AUMENTADA",
  "REALIDAD_VIRTUAL",
  "REALIDAD_MIXTA",
  "MODELADO_3D",
  "VIDEO",
  "PODCAST",
]);
export const resourceComplexitySchema = z.enum(["SIMPLE", "MEDIO", "ALTO"]);
export const resourceToolSchema = z.enum(["GENIALLY", "POWTOON", "CANVA", "EDUCAPLAY", "PODCAST", "VIDEO_CORTO", "OTRA"]);

const resourceReferenceSchema = z.strictObject({
  url: z.string().nullable(),
  description: z.string().nullable(),
});

const resourceBibliographySchema = z.strictObject({
  reference: z.string().min(1),
  style: z.literal("APA7"),
  sourceUrl: z.string().nullable(),
});

const interactiveScreenSchema = z.strictObject({
  order: z.number().int().positive(),
  referenceElements: z.array(z.string()).default([]),
  contentText: z.string(),
  productionDescription: z.string(),
});

const audiovisualSceneSchema = z.strictObject({
  order: z.number().int().positive(),
  referenceElements: z.array(z.string()).default([]),
  voiceOver: z.string(),
  onScreenText: z.string(),
  productionDescription: z.string(),
});

const interactiveScriptSchema = z.strictObject({
  format: z.literal("interactive"),
  screens: z.array(interactiveScreenSchema).min(1),
});

const audiovisualScriptSchema = z.strictObject({
  format: z.literal("audiovisual"),
  hook: z.string().min(1),
  development: z.string().min(1),
  motivationalClosing: z.string().min(1),
  scenes: z.array(audiovisualSceneSchema).min(1),
});

export const educationalResourceSchema = z.strictObject({
  id: z.string().min(1),
  status: z.enum(["proposed", "teacher_approved", "rejected"]),
  bloomLevel: bloomLevelSchema,
  resourceType: educationalResourceTypeSchema,
  complexity: resourceComplexitySchema,
  tool: resourceToolSchema.nullable(),
  title: z.string().min(1),
  purpose: z.string().min(1),
  rationale: z.string().min(1),
  subjectName: z.string().min(1),
  subjectCode: z.string(),
  professorName: z.string(),
  weekNumber: z.number().int().positive(),
  referenceResource: resourceReferenceSchema,
  script: z.union([interactiveScriptSchema, audiovisualScriptSchema]),
  bibliography: z.array(resourceBibliographySchema).min(1),
});
export type EducationalResource = z.infer<typeof educationalResourceSchema>;

export const guideAiSectionSchema = z.strictObject({
  sourceId: z.string().min(1),
  markdown: z.string().trim().min(1).max(50_000),
});

export const guideAiWeekResponseSchema = z.strictObject({
  sections: z.array(guideAiSectionSchema).min(1).max(60),
});
export type GuideAiWeekResponse = z.infer<typeof guideAiWeekResponseSchema>;

export const guideWeekStructuredContentSchema = z.strictObject({
  format: z.literal("structured"),
  blocks: z.array(guideBlockSchema),
  resources: z.array(educationalResourceSchema).default([]),
});
export type GuideWeekStructuredContent = z.infer<typeof guideWeekStructuredContentSchema>;

type OfferingHierarchy = {
  units: Array<{
    id: string;
    title: string;
    contents: Array<{
      id: string;
      text: string;
      subcontents: Array<{ id: string; text: string }>;
    }>;
  }>;
};

function stripInstitutionalPrefix(value: string) {
  return value
    .replace(/^\s*(?:UNIDAD|CONTENIDO|SUBCONTENIDO)\s*:?\s*/iu, "")
    .replace(/^\s*UNIDAD\s+\d+(?:\.\d+)*\s*(?:[.)]|[:\-–—])?\s*/iu, "")
    .replace(/^\s*\d+(?:\.\d+){0,3}\s*(?:[.)]|[:\-–—])\s*/u, "")
    .trim();
}

function normalizedLiteral(value: string) {
  return stripInstitutionalPrefix(value)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("es")
    .replace(/[^a-z0-9]+/giu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sentenceCase(value: string) {
  const trimmed = stripInstitutionalPrefix(value);
  if (!trimmed) return trimmed;
  if (trimmed !== trimmed.toLocaleUpperCase("es")) return trimmed;
  const lower = trimmed.toLocaleLowerCase("es");
  return lower.replace(/^([a-záéíóúüñ])/u, (letter) => letter.toLocaleUpperCase("es"));
}

export function buildGuideWeekOutline(hierarchy: OfferingHierarchy, weekLiterals: string[]): GuideOutlineItem[] {
  const requested = new Set(weekLiterals.flatMap((value) => value.split(/\r?\n/u)).map(normalizedLiteral).filter(Boolean));
  const selected: GuideOutlineItem[] = [];
  const seen = new Set<string>();
  const add = (item: GuideOutlineItem) => {
    if (seen.has(item.sourceId)) return;
    seen.add(item.sourceId);
    selected.push(item);
  };

  hierarchy.units.forEach((unit, unitIndex) => {
    const unitNumber = unitIndex + 1;
    const unitMatch = requested.has(normalizedLiteral(unit.title));
    unit.contents.forEach((content, contentIndex) => {
      const contentNumber = `${unitNumber}.${contentIndex + 1}`;
      const contentMatch = requested.has(normalizedLiteral(content.text));
      const matchingSubcontents = content.subcontents.filter((subcontent) => requested.has(normalizedLiteral(subcontent.text)));
      if (unitMatch || contentMatch || matchingSubcontents.length) {
        add({
          sourceId: `unit-${unit.id}`,
          role: "unit",
          level: 1,
          number: String(unitNumber),
          text: sentenceCase(unit.title),
          literal: unit.title,
          develop: unitMatch,
        });
      }
      if (contentMatch || matchingSubcontents.length) {
        add({
          sourceId: `content-${content.id}`,
          role: "topic",
          level: 2,
          number: contentNumber,
          text: content.text.trim(),
          literal: content.text,
          develop: contentMatch,
        });
      }
      content.subcontents.forEach((subcontent, subcontentIndex) => {
        if (!requested.has(normalizedLiteral(subcontent.text))) return;
        add({
          sourceId: `subcontent-${subcontent.id}`,
          role: "subtopic",
          level: 3,
          number: `${contentNumber}.${subcontentIndex + 1}`,
          text: subcontent.text.trim(),
          literal: subcontent.text,
          develop: true,
        });
      });
    });
  });

  // Compatibilidad únicamente con ofertas todavía no normalizadas en relaciones.
  // No conserva Guías v1/v2: evita bloquear la generación mientras el administrador
  // termina de estructurar las unidades del catálogo.
  if (!selected.length) {
    weekLiterals.flatMap((value) => value.split(/\r?\n/u)).map((value) => value.trim()).filter(Boolean).forEach((literal, index) => {
      const role: GuideHeadingRole = /SUBCONTENIDO/iu.test(literal) ? "subtopic" : /CONTENIDO/iu.test(literal) ? "topic" : "unit";
      const level = role === "unit" ? 1 : role === "topic" ? 2 : 3;
      const number = role === "unit" ? String(index + 1) : role === "topic" ? `1.${index + 1}` : `1.1.${index + 1}`;
      add({ sourceId: `legacy-outline-${index + 1}`, role, level, number, text: sentenceCase(literal), literal, develop: true });
    });
  }
  return selected;
}

export function guideOutlineInstructions(outline: GuideOutlineItem[]) {
  return outline.map((item) => ({
    sourceId: item.sourceId,
    heading: item.role === "unit"
      ? `Unidad ${item.number}: ${item.text}`
      : `${item.number}. ${item.text}`,
    role: item.role,
    develop: item.develop,
  }));
}

export function assembleGuideWeekMarkdown(outline: GuideOutlineItem[], response: GuideAiWeekResponse) {
  const byId = new Map(response.sections.map((section) => [section.sourceId, section.markdown.trim()]));
  const expected = new Set(outline.filter((item) => item.develop).map((item) => item.sourceId));
  if (byId.size !== expected.size || [...byId.keys()].some((id) => !expected.has(id))) {
    throw new Error("La IA no devolvió exactamente las secciones institucionales que deben desarrollarse para la semana.");
  }
  return outline.map((item) => {
    const hashes = "#".repeat(Math.min(4, item.level + 1));
    const heading = item.role === "unit" ? `Unidad ${item.number}: ${item.text}` : `${item.number}. ${item.text}`;
    const body = item.develop ? (byId.get(item.sourceId) ?? "") : "";
    return `${hashes} ${heading}${body ? `\n\n${body}` : ""}`.trim();
  }).join("\n\n");
}

function parseInline(value: string): GuideInline[] {
  const result: GuideInline[] = [];
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\)|https?:\/\/[^\s)]+)/gu;
  let cursor = 0;
  for (const match of value.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > cursor) result.push({ type: "text", text: value.slice(cursor, index), marks: [] });
    const token = match[0];
    const link = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/u);
    if (link) result.push({ type: "link", text: link[1] ?? "", href: link[2] ?? "", marks: [] });
    else if (token.startsWith("**") && token.endsWith("**")) result.push({ type: "text", text: token.slice(2, -2), marks: ["bold"] });
    else if (token.startsWith("*") && token.endsWith("*")) result.push({ type: "text", text: token.slice(1, -1), marks: ["italic"] });
    else result.push({ type: "link", text: token, href: token, marks: [] });
    cursor = index + token.length;
  }
  if (cursor < value.length) result.push({ type: "text", text: value.slice(cursor), marks: [] });
  return result.length ? result : [{ type: "text", text: value, marks: [] }];
}

function markdownCells(line: string) {
  return line.trim().replace(/^\||\|$/gu, "").split("|").map((item) => item.trim());
}

function isMarkdownTableSeparator(line: string) {
  const cells = markdownCells(line);
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/u.test(cell));
}

function headingRoleFromText(text: string, level: number): { role: GuideHeadingRole; number: string; text: string } | null {
  const unit = text.match(/^Unidad\s+(\d+)\s*:\s*(.+)$/iu);
  if (unit) return { role: "unit", number: unit[1]!, text: unit[2]!.trim() };
  const numbered = text.match(/^(\d+(?:\.\d+){1,2})\.?\s+(.+)$/u);
  if (!numbered) return null;
  const depth = numbered[1]!.split(".").length;
  return { role: depth >= 3 || level >= 4 ? "subtopic" : "topic", number: numbered[1]!, text: numbered[2]!.trim() };
}


function decodeGuideHtmlEntities(value: string) {
  const named: Record<string, string> = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
    nbsp: " ",
  };
  return value.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/giu, (entity, token: string) => {
    const normalized = token.toLowerCase();
    if (normalized.startsWith("#x")) {
      const codePoint = Number.parseInt(normalized.slice(2), 16);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : entity;
    }
    if (normalized.startsWith("#")) {
      const codePoint = Number.parseInt(normalized.slice(1), 10);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : entity;
    }
    return named[normalized] ?? entity;
  });
}

export function normalizeGuideRichTextForExport(value: string) {
  let normalized = String(value ?? "");
  normalized = normalized
    .replace(/<br\s*\/?\s*>/giu, "\n")
    .replace(/<\/p\s*>/giu, "\n")
    .replace(/<p\b[^>]*>/giu, "")
    .replace(/<li\b[^>]*>/giu, "• ")
    .replace(/<\/li\s*>/giu, "\n")
    .replace(/<(?:strong|b)\b[^>]*>([\s\S]*?)<\/(?:strong|b)>/giu, "**$1**")
    .replace(/<(?:em|i)\b[^>]*>([\s\S]*?)<\/(?:em|i)>/giu, "*$1*")
    .replace(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/giu, (_match, href: string, label: string) => `[${label}](${href})`)
    .replace(/<[^>]+>/gu, "")
    .replace(/\\\|/gu, "|");
  return decodeGuideHtmlEntities(normalized)
    .replace(/[ \t]+\n/gu, "\n")
    .replace(/\n[ \t]+/gu, "\n")
    .replace(/\n{3,}/gu, "\n\n")
    .trim();
}

function unescapeMarkdownCell(value: string) {
  return normalizeGuideRichTextForExport(value);
}

type ParsedMarkdownTable = { headers: string[]; rows: string[][]; start: number; end: number };

function markdownTables(markdownLines: string[]): ParsedMarkdownTable[] {
  const tables: ParsedMarkdownTable[] = [];
  for (let index = 0; index < markdownLines.length - 1; index += 1) {
    const line = (markdownLines[index] ?? "").trim();
    const separator = (markdownLines[index + 1] ?? "").trim();
    if (!line.includes("|") || !isMarkdownTableSeparator(separator)) continue;
    const headers = markdownCells(line).map(unescapeMarkdownCell);
    const rows: string[][] = [];
    let cursor = index + 2;
    while (cursor < markdownLines.length && (markdownLines[cursor] ?? "").includes("|")) {
      rows.push(markdownCells(markdownLines[cursor] ?? "").map(unescapeMarkdownCell));
      cursor += 1;
    }
    tables.push({ headers, rows, start: index, end: cursor - 1 });
    index = cursor - 1;
  }
  return tables;
}

function splitReferenceElements(value: string, prefix: RegExp) {
  const values = value.split(/\s*·\s*/u).map((item) => item.trim()).filter(Boolean);
  const first = values[0] ?? "";
  const order = Number.parseInt(first.replace(prefix, "").trim(), 10);
  return { order: Number.isFinite(order) && order > 0 ? order : 1, elements: values.slice(1) };
}

function extractEducationalResources(
  markdown: string,
  weekNumber: number,
  status: "proposed" | "teacher_approved",
): EducationalResource[] {
  const allLines = markdown.replace(/\r\n?/gu, "\n").split("\n");
  const starts: number[] = [];
  allLines.forEach((line, index) => {
    if (/^#{1,4}\s+Recurso educativo:\s*.+$/iu.test(line.trim())) starts.push(index);
  });
  const resources: EducationalResource[] = [];
  starts.forEach((start, resourceIndex) => {
    let end = allLines.length;
    for (let cursor = start + 1; cursor < allLines.length; cursor += 1) {
      if (/^#{1,4}\s+.+$/u.test((allLines[cursor] ?? "").trim())) {
        end = cursor;
        break;
      }
    }
    const segment = allLines.slice(start, end);
    const heading = (segment[0] ?? "").trim().match(/^#{1,4}\s+Recurso educativo:\s*(.+)$/iu);
    if (!heading) return;
    const tables = markdownTables(segment);
    const metadataTable = tables.find((table) => table.headers.length >= 2 && /^Campo$/iu.test(table.headers[0] ?? "") && /^Información$/iu.test(table.headers[1] ?? ""));
    const scriptTable = tables.find((table) => /^Elementos de referencia$/iu.test(table.headers[0] ?? ""));
    if (!metadataTable || !scriptTable) return;
    const metadata = new Map(metadataTable.rows.map((row) => [row[0]?.trim() ?? "", row[1]?.trim() ?? ""]));
    const bloomLevel = metadata.get("Nivel de Bloom") || metadata.get("Nivel Bloom") || null;
    const resourceType = metadata.get("Tipo de recurso") || metadata.get("Tipo") || null;
    const complexity = metadata.get("Nivel de complejidad") || metadata.get("Complejidad") || null;
    const toolText = metadata.get("Herramienta sugerida") || null;
    const purpose = metadata.get("Propósito") || "";
    const rationale = metadata.get("Justificación pedagógica") || "";
    if (!bloomLevel || !resourceType || !complexity || !purpose || !rationale) return;
    const referenceValue = metadata.get("URL o descripción del recurso de referencia (opcional)")?.trim() ?? "";
    const referenceResource = !referenceValue || /^No aplica$/iu.test(referenceValue)
      ? { url: null, description: null }
      : /^https?:\/\//iu.test(referenceValue)
        ? { url: referenceValue, description: null }
        : { url: null, description: referenceValue };
    const isAudiovisual = scriptTable.headers.some((header) => /^Voz en off$/iu.test(header));
    const script = isAudiovisual
      ? (() => {
          const scenes = scriptTable.rows.map((row, index) => {
            const reference = splitReferenceElements(row[0] ?? `Escena ${index + 1}`, /^Escena\s*/iu);
            return {
              order: reference.order,
              referenceElements: reference.elements,
              voiceOver: row[1] ?? "",
              onScreenText: row[2] ?? "",
              productionDescription: row[3] ?? "",
            };
          });
          const voiceOvers = scenes.map((scene) => scene.voiceOver).filter(Boolean);
          return {
            format: "audiovisual" as const,
            hook: voiceOvers[0] ?? "Introducción del recurso.",
            development: voiceOvers.join("\n"),
            motivationalClosing: voiceOvers.at(-1) ?? "Cierre del recurso.",
            scenes,
          };
        })()
      : {
          format: "interactive" as const,
          screens: scriptTable.rows.map((row, index) => {
            const reference = splitReferenceElements(row[0] ?? `Pantalla ${index + 1}`, /^Pantalla\s*/iu);
            return {
              order: reference.order,
              referenceElements: reference.elements,
              contentText: row[1] ?? "",
              productionDescription: row[2] ?? "",
            };
          }),
        };
    const bibliographyIndex = segment.findIndex((line) => /^\*\*Referencias bibliográficas del recurso \(APA 7\):\*\*/iu.test(line.trim()));
    const bibliography = bibliographyIndex < 0 ? [] : segment.slice(bibliographyIndex + 1)
      .map((line) => line.trim().match(/^\d+[.)]\s+(.+)$/u)?.[1]?.trim())
      .filter((value): value is string => Boolean(value))
      .map((reference) => ({
        reference,
        style: "APA7" as const,
        sourceUrl: reference.match(/https?:\/\/\S+/u)?.[0] ?? null,
      }));
    const candidate = educationalResourceSchema.safeParse({
      id: `resource-w${weekNumber}-${resourceIndex + 1}`,
      status,
      bloomLevel,
      resourceType,
      complexity,
      tool: toolText || null,
      title: metadata.get("Título del recurso")?.trim() || heading[1]!.trim(),
      purpose,
      rationale,
      subjectName: metadata.get("Asignatura")?.trim() || "Asignatura",
      subjectCode: metadata.get("Código")?.trim() || "",
      professorName: metadata.get("Profesor")?.trim() || "",
      weekNumber: Number.parseInt(metadata.get("Semana") ?? "", 10) || weekNumber,
      referenceResource,
      script,
      bibliography,
    });
    if (candidate.success) resources.push(candidate.data);
  });
  return resources;
}

export function markdownToStructuredGuideContent(
  markdown: string,
  weekNumber: number,
  resourceStatus: "proposed" | "teacher_approved" = "proposed",
): GuideWeekStructuredContent {
  const lines = markdown.replace(/\r\n?/gu, "\n").split("\n");
  const blocks: GuideBlock[] = [];
  const resources = extractEducationalResources(markdown, weekNumber, resourceStatus);
  let resourceCursor = 0;
  let sequence = 0;
  const nextId = (prefix: string) => `w${weekNumber}-${prefix}-${++sequence}`;
  for (let index = 0; index < lines.length; index += 1) {
    const line = (lines[index] ?? "").trim();
    if (!line || /^<!--.*-->$/u.test(line)) continue;
    const image = line.match(/^!\[([^\]]*)\]\(([^)]+)\)$/u);
    if (image) {
      const asset = image[2]!.match(/\/api\/generated-images\/([0-9a-f-]{36})/iu)?.[1] ?? null;
      blocks.push({ id: nextId("image"), type: "image", assetId: asset, src: image[2]!, altText: image[1] ?? "", caption: null, source: null });
      continue;
    }
    const heading = line.match(/^(#{1,4})\s+(.+)$/u);
    if (heading) {
      const resourceTitle = heading[2]!.match(/^Recurso educativo:\s*(.+)$/iu);
      if (resourceTitle) {
        const resource = resources[resourceCursor];
        resourceCursor += 1;
        if (resource) {
          blocks.push({
            id: nextId("resource"),
            type: "educational_resource",
            resourceId: resource.id,
            title: resource.title,
            status: resource.status,
          });
        }
        // La ficha y el guion pertenecen al recurso educativo. No se exponen como
        // párrafos o tablas académicas del contenido canónico.
        let cursor = index + 1;
        while (cursor < lines.length && !/^#{1,4}\s+.+$/u.test((lines[cursor] ?? "").trim())) cursor += 1;
        index = cursor - 1;
        continue;
      }
      const info = headingRoleFromText(heading[2]!, heading[1]!.length);
      if (info) {
        blocks.push({ id: nextId("heading"), type: "heading", role: info.role, level: info.role === "unit" ? 1 : info.role === "topic" ? 2 : 3, number: info.number, text: info.text, sourceId: `heading-${info.number}` });
      } else {
        blocks.push({ id: nextId("paragraph"), type: "paragraph", content: parseInline(heading[2]!) });
      }
      continue;
    }
    const nextLine = (lines[index + 1] ?? "").trim();
    if (line.includes("|") && isMarkdownTableSeparator(nextLine)) {
      const headers = markdownCells(line).map(unescapeMarkdownCell);
      const rows: string[][] = [];
      index += 2;
      while (index < lines.length && (lines[index] ?? "").includes("|")) {
        rows.push(markdownCells(lines[index] ?? "").map(unescapeMarkdownCell));
        index += 1;
      }
      index -= 1;
      if (rows.length) blocks.push({ id: nextId("table"), type: "table", caption: null, headers, rows });
      continue;
    }
    const bullets: string[] = [];
    let bulletIndex = index;
    while (bulletIndex < lines.length) {
      const bullet = (lines[bulletIndex] ?? "").trim().match(/^[-*]\s+(.+)$/u);
      if (!bullet) break;
      bullets.push(bullet[1]!);
      bulletIndex += 1;
    }
    if (bullets.length) {
      blocks.push({ id: nextId("list"), type: "list", style: "bullet", items: bullets.map(parseInline) });
      index = bulletIndex - 1;
      continue;
    }
    const ordered: string[] = [];
    let orderedIndex = index;
    while (orderedIndex < lines.length) {
      const item = (lines[orderedIndex] ?? "").trim().match(/^\d+[.)]\s+(.+)$/u);
      if (!item) break;
      ordered.push(item[1]!);
      orderedIndex += 1;
    }
    if (ordered.length) {
      blocks.push({ id: nextId("list"), type: "list", style: "ordered", items: ordered.map(parseInline) });
      index = orderedIndex - 1;
      continue;
    }
    const callout = line.match(/^>\s*\[!(IMPORTANT|NOTE|TIP|WARNING|QUESTION|EXAMPLE|DEFINITION|REFLECTION)\]\s*(.*)$/iu);
    if (callout) {
      const variants: Record<string, z.infer<typeof guideCalloutBlockSchema>["variant"]> = {
        IMPORTANT: "important", NOTE: "remember", TIP: "tip", WARNING: "warning", QUESTION: "question", EXAMPLE: "example", DEFINITION: "definition", REFLECTION: "reflection",
      };
      const variant = variants[callout[1]!.toUpperCase()] ?? "important";
      const body: string[] = [];
      let calloutIndex = index + 1;
      while (calloutIndex < lines.length) {
        const quoted = (lines[calloutIndex] ?? "").trim().match(/^>\s?(.*)$/u);
        if (!quoted) break;
        const quotedText = quoted[1]?.trim() ?? "";
        if (quotedText) body.push(quotedText);
        calloutIndex += 1;
      }
      blocks.push({
        id: nextId("callout"),
        type: "callout",
        variant,
        title: callout[2]?.trim() || null,
        content: parseInline(body.join(" ")),
      });
      index = calloutIndex - 1;
      continue;
    }
    const quote = line.match(/^>\s+(.+)$/u);
    if (quote) {
      blocks.push({ id: nextId("quote"), type: "quote", content: parseInline(quote[1]!), attribution: null });
      continue;
    }
    blocks.push({ id: nextId("paragraph"), type: "paragraph", content: parseInline(line) });
  }
  return guideWeekStructuredContentSchema.parse({ format: "structured", blocks, resources });
}

export const institutionalResourceComplexity = {
  INFOGRAFIA: "SIMPLE",
  IMAGEN_INTERACTIVA: "SIMPLE",
  QUIZ: "SIMPLE",
  VIDEO_QUIZ: "SIMPLE",
  PRESENTACION_INTERACTIVA: "SIMPLE",
  MODULO_DIDACTICO: "MEDIO",
  UNIR_CON_LINEAS: "MEDIO",
  ARRASTRAR_Y_SOLTAR: "MEDIO",
  ROMPECABEZAS: "MEDIO",
  COMPLETAR_TEXTO: "MEDIO",
  CRUCIGRAMA: "MEDIO",
  SOPA_DE_LETRAS: "MEDIO",
  IMAGEN_INTERACTIVA_360: "MEDIO",
  DICTADO: "MEDIO",
  VIDEO_INTERACTIVO: "MEDIO",
  STORYTELLING: "MEDIO",
  MARCAR_CASILLAS: "MEDIO",
  VIDEO: "MEDIO",
  PODCAST: "MEDIO",
  GAMIFICACION: "ALTO",
  SIMULACION: "ALTO",
  REALIDAD_AUMENTADA: "ALTO",
  REALIDAD_VIRTUAL: "ALTO",
  REALIDAD_MIXTA: "ALTO",
  MODELADO_3D: "ALTO",
} as const;

export const institutionalResourceRules = {
  RECORDAR: ["DICTADO", "SOPA_DE_LETRAS", "CRUCIGRAMA", "MARCAR_CASILLAS"],
  COMPRENDER: ["INFOGRAFIA", "IMAGEN_INTERACTIVA", "PRESENTACION_INTERACTIVA", "COMPLETAR_TEXTO"],
  APLICAR: ["ARRASTRAR_Y_SOLTAR", "UNIR_CON_LINEAS", "VIDEO_QUIZ", "QUIZ"],
  ANALIZAR: ["IMAGEN_INTERACTIVA_360", "VIDEO_INTERACTIVO", "STORYTELLING"],
  EVALUAR: ["SIMULACION"],
  CREAR: ["GAMIFICACION", "MODULO_DIDACTICO", "REALIDAD_AUMENTADA", "REALIDAD_VIRTUAL", "REALIDAD_MIXTA", "MODELADO_3D"],
} as const;

function markdownTableRow(values: string[]) {
  return `| ${values.map((value) => value.replace(/\|/gu, "\\|").replace(/\r?\n/gu, "<br>")).join(" | ")} |`;
}

export function educationalResourceToMarkdown(resource: EducationalResource) {
  const metadataRows = [
    ["Asignatura", resource.subjectName],
    ["Código", resource.subjectCode],
    ["Profesor", resource.professorName],
    ["Semana", String(resource.weekNumber)],
    ["Título del recurso", resource.title],
    ["Nivel de Bloom", resource.bloomLevel],
    ["Tipo de recurso", resource.resourceType],
    ["Nivel de complejidad", resource.complexity],
    ["Herramienta sugerida", resource.tool || "No definida"],
    ["Propósito", resource.purpose],
    ["Justificación pedagógica", resource.rationale],
    ["URL o descripción del recurso de referencia (opcional)", resource.referenceResource.url || resource.referenceResource.description || "No aplica"],
  ];
  const metadata = [
    "<!-- GUIDE_RESOURCE_TABLE:FICHA -->",
    markdownTableRow(["Campo", "Información"]),
    markdownTableRow(["---", "---"]),
    ...metadataRows.map(markdownTableRow),
  ].join("\n");

  let scriptTable = "";
  if (resource.script.format === "interactive") {
    scriptTable = [
      "<!-- GUIDE_RESOURCE_TABLE:GUION -->",
      markdownTableRow(["Elementos de referencia", "Contenido o Texto", "Descripción"]),
      markdownTableRow(["---", "---", "---"]),
      ...resource.script.screens.map((screen) => markdownTableRow([
        [`Pantalla ${screen.order}`, ...screen.referenceElements].filter(Boolean).join(" · "),
        screen.contentText,
        screen.productionDescription,
      ])),
    ].join("\n");
  } else {
    scriptTable = [
      "<!-- GUIDE_RESOURCE_TABLE:GUION -->",
      markdownTableRow(["Elementos de referencia", "Voz en off", "Contenido o Texto", "Descripción"]),
      markdownTableRow(["---", "---", "---", "---"]),
      ...resource.script.scenes.map((scene) => markdownTableRow([
        [`Escena ${scene.order}`, ...scene.referenceElements].filter(Boolean).join(" · "),
        scene.voiceOver,
        scene.onScreenText,
        scene.productionDescription,
      ])),
    ].join("\n");
  }
  const bibliography = resource.bibliography.map((item, index) => {
    const url = item.sourceUrl && !item.reference.includes(item.sourceUrl) ? ` ${item.sourceUrl}` : "";
    return `${index + 1}. ${item.reference}${url}`;
  }).join("\n");
  return `### Recurso educativo: ${resource.title}\n\n**Ficha del recurso**\n\n${metadata}\n\n**Guion del recurso**\n\n${scriptTable}\n\n**Referencias bibliográficas del recurso (APA 7):**\n\n${bibliography}`;
}
