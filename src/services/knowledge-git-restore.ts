import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { database } from "../db/client.js";
import {
  canonicalFunctionalSpecificationPath,
  canonicalOfficialKnowledgePath,
  guideIndicatorStructureChecksum,
  renderGuideIndicatorSpecification,
  type FunctionalSpecificationManifest,
  type FunctionalSpecificationManifestItem,
  type GuideIndicatorManifestItem,
  type OfficialKnowledgeManifest,
  type OfficialKnowledgeManifestDocument,
} from "./official-knowledge-sync.js";

const PROJECT_ROOT = fileURLToPath(new URL("../../", import.meta.url));
const OFFICIAL_MANIFEST = "knowledge/official/manifest.json";
const SPECIFICATIONS_MANIFEST = "knowledge/specifications/manifest.json";
const INDICATOR_KEY = "indicadores-generales";

export type KnowledgeGitSnapshot = {
  projectRoot: string;
  documents: Array<OfficialKnowledgeManifestDocument & { bytes: Buffer }>;
  generationInstructions: Array<FunctionalSpecificationManifestItem & { content: string }>;
  indicatorVersion: (FunctionalSpecificationManifestItem & {
    guideIndicators: GuideIndicatorManifestItem[];
    structureChecksum: string;
    content: string;
  }) | null;
};

export type KnowledgeRestoreSummary = {
  documentsCreated: number;
  documentsAligned: number;
  instructionsCreated: number;
  instructionsReactivated: number;
  instructionsAligned: number;
  indicatorCreated: boolean;
  indicatorReactivated: boolean;
  indicatorUnchanged: boolean;
};

type RestoreConflict = {
  scope: "DOCUMENT" | "SPECIFICATION" | "INDICATORS";
  key: string;
  message: string;
};

function sha256(content: Buffer | string) {
  return createHash("sha256").update(content).digest("hex");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function requireString(record: Record<string, unknown>, key: string, context: string) {
  const value = record[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${context}: el campo «${key}» es obligatorio.`);
  }
  return value;
}

function requireNumber(record: Record<string, unknown>, key: string, context: string) {
  const value = record[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${context}: el campo «${key}» debe ser numérico.`);
  }
  return value;
}

function requireBoolean(record: Record<string, unknown>, key: string, context: string) {
  const value = record[key];
  if (typeof value !== "boolean") {
    throw new Error(`${context}: el campo «${key}» debe ser booleano.`);
  }
  return value;
}

function stringArray(value: unknown, context: string) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`${context}: se esperaba una lista de textos.`);
  }
  return [...value] as string[];
}

function numberArray(value: unknown, context: string) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "number" || !Number.isFinite(item))) {
    throw new Error(`${context}: se esperaba una lista de números.`);
  }
  return [...value] as number[];
}

function absolutePath(projectRoot: string, relativePath: string) {
  const root = resolve(projectRoot);
  const absolute = resolve(root, relativePath);
  if (absolute === root || !absolute.startsWith(`${root}/`)) {
    throw new Error(`Ruta fuera del repositorio: ${relativePath}`);
  }
  return absolute;
}

async function fileExists(path: string) {
  try {
    await access(path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

async function parseJsonFile(projectRoot: string, relativePath: string) {
  const path = absolutePath(projectRoot, relativePath);
  if (!await fileExists(path)) {
    throw new Error(`No existe ${relativePath}. Ejecute primero «npm run knowledge:sync-git» en el repositorio fuente.`);
  }
  try {
    return JSON.parse(await readFile(path, "utf8")) as unknown;
  } catch (error) {
    throw new Error(`No se pudo leer ${relativePath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function parseOfficialManifest(value: unknown): OfficialKnowledgeManifest {
  if (!isRecord(value)) throw new Error(`${OFFICIAL_MANIFEST}: formato inválido.`);
  if (value.schemaVersion !== 1 || value.environmentPolicy !== "LATEST_ACTIVE_ONLY" || !Array.isArray(value.documents)) {
    throw new Error(`${OFFICIAL_MANIFEST}: versión o política no compatible.`);
  }

  const documents = value.documents.map((raw, index) => {
    const context = `${OFFICIAL_MANIFEST} documents[${index}]`;
    if (!isRecord(raw)) throw new Error(`${context}: formato inválido.`);
    const key = requireString(raw, "key", context);
    const title = requireString(raw, "title", context);
    const gitPath = requireString(raw, "gitPath", context);
    const mimeType = requireString(raw, "mimeType", context);
    const checksum = requireString(raw, "checksum", context);
    const originalName = raw.originalName === null ? null : requireString(raw, "originalName", context);
    const contentMarkdown = raw.contentMarkdown === null ? null : typeof raw.contentMarkdown === "string"
      ? raw.contentMarkdown
      : (() => { throw new Error(`${context}: contentMarkdown debe ser texto o null.`); })();
    const effectiveFrom = raw.effectiveFrom === null ? null : typeof raw.effectiveFrom === "string"
      ? raw.effectiveFrom
      : (() => { throw new Error(`${context}: effectiveFrom debe ser fecha o null.`); })();
    if (raw.status !== "ACTIVE") throw new Error(`${context}: solo se restauran documentos ACTIVE.`);

    const parsed: OfficialKnowledgeManifestDocument = {
      key,
      title,
      status: "ACTIVE",
      gitPath,
      mimeType,
      originalName,
      checksum,
      contentMarkdown,
      priority: requireNumber(raw, "priority", context),
      academicLevels: stringArray(raw.academicLevels, `${context}.academicLevels`),
      modalities: stringArray(raw.modalities, `${context}.modalities`),
      durations: numberArray(raw.durations, `${context}.durations`),
      subjectTypes: stringArray(raw.subjectTypes, `${context}.subjectTypes`),
      appliesToAll: requireBoolean(raw, "appliesToAll", context),
      resourceKind: requireString(raw, "resourceKind", context),
      appliesToPlan: requireBoolean(raw, "appliesToPlan", context),
      appliesToGuide: requireBoolean(raw, "appliesToGuide", context),
      effectiveFrom,
      provisional: requireBoolean(raw, "provisional", context),
    };

    const canonical = canonicalOfficialKnowledgePath({
      key: parsed.key,
      mimeType: parsed.mimeType,
      originalName: parsed.originalName,
      storagePath: parsed.gitPath,
    });
    if (parsed.gitPath !== canonical || !parsed.gitPath.startsWith("knowledge/official/")) {
      throw new Error(`${context}: gitPath no es la ruta canónica esperada (${canonical}).`);
    }
    return parsed;
  });

  const duplicate = documents.find((item, index) => documents.findIndex((candidate) => candidate.key === item.key) !== index);
  if (duplicate) throw new Error(`${OFFICIAL_MANIFEST}: clave duplicada «${duplicate.key}».`);

  return {
    schemaVersion: 1,
    environmentPolicy: "LATEST_ACTIVE_ONLY",
    description: typeof value.description === "string" ? value.description : "",
    documents,
  };
}

function parseGuideIndicators(value: unknown, context: string): GuideIndicatorManifestItem[] {
  if (!Array.isArray(value)) throw new Error(`${context}: guideIndicators es obligatorio para ${INDICATOR_KEY}.`);
  const indicators = value.map((raw, index) => {
    const itemContext = `${context}.guideIndicators[${index}]`;
    if (!isRecord(raw)) throw new Error(`${itemContext}: formato inválido.`);
    return {
      code: requireString(raw, "code", itemContext),
      name: requireString(raw, "name", itemContext),
      description: typeof raw.description === "string" ? raw.description : "",
      stage: requireString(raw, "stage", itemContext),
      score: requireNumber(raw, "score", itemContext),
      active: requireBoolean(raw, "active", itemContext),
      required: requireBoolean(raw, "required", itemContext),
      sortOrder: requireNumber(raw, "sortOrder", itemContext),
    };
  });
  const duplicate = indicators.find((item, index) => indicators.findIndex((candidate) => candidate.code === item.code) !== index);
  if (duplicate) throw new Error(`${context}: indicador duplicado «${duplicate.code}».`);
  return indicators;
}

function parseSpecificationManifest(value: unknown): FunctionalSpecificationManifest {
  if (!isRecord(value)) throw new Error(`${SPECIFICATIONS_MANIFEST}: formato inválido.`);
  if (value.schemaVersion !== 2) {
    throw new Error(
      `${SPECIFICATIONS_MANIFEST}: se requiere schemaVersion 2 para restaurar la configuración estructurada. ` +
      `Ejecute «npm run knowledge:sync-git» con v32.4.3 antes de hacer el commit.`,
    );
  }
  if (value.environmentPolicy !== "LATEST_ACTIVE_ONLY" || !Array.isArray(value.specifications)) {
    throw new Error(`${SPECIFICATIONS_MANIFEST}: política o contenido no compatible.`);
  }

  const specifications = value.specifications.map((raw, index) => {
    const context = `${SPECIFICATIONS_MANIFEST} specifications[${index}]`;
    if (!isRecord(raw)) throw new Error(`${context}: formato inválido.`);
    const sourceType = raw.sourceType;
    if (sourceType !== "GENERATION_INSTRUCTION" && sourceType !== "GUIDE_INDICATOR_VERSION") {
      throw new Error(`${context}: sourceType no compatible.`);
    }
    const key = requireString(raw, "key", context);
    const gitPath = requireString(raw, "gitPath", context);
    const expectedPath = canonicalFunctionalSpecificationPath(key);
    if (gitPath !== expectedPath || !gitPath.startsWith("knowledge/specifications/")) {
      throw new Error(`${context}: gitPath no es la ruta canónica esperada (${expectedPath}).`);
    }
    if (raw.status !== "ACTIVE") throw new Error(`${context}: solo se restauran especificaciones ACTIVE.`);

    const base: FunctionalSpecificationManifestItem = {
      sourceType,
      key,
      title: requireString(raw, "title", context),
      version: requireNumber(raw, "version", context),
      status: "ACTIVE",
      gitPath,
      checksum: requireString(raw, "checksum", context),
      priority: raw.priority === null ? null : requireNumber(raw, "priority", context),
      academicLevels: stringArray(raw.academicLevels, `${context}.academicLevels`),
      modalities: stringArray(raw.modalities, `${context}.modalities`),
      durations: numberArray(raw.durations, `${context}.durations`),
      subjectTypes: stringArray(raw.subjectTypes, `${context}.subjectTypes`),
      processes: stringArray(raw.processes, `${context}.processes`),
    };

    if (sourceType === "GUIDE_INDICATOR_VERSION") {
      if (key !== INDICATOR_KEY) throw new Error(`${context}: la configuración de indicadores debe usar la clave ${INDICATOR_KEY}.`);
      base.guideIndicators = parseGuideIndicators(raw.guideIndicators, context);
      base.structureChecksum = requireString(raw, "structureChecksum", context);
    }
    return base;
  });

  const duplicate = specifications.find((item, index) => specifications.findIndex((candidate) => candidate.key === item.key) !== index);
  if (duplicate) throw new Error(`${SPECIFICATIONS_MANIFEST}: clave duplicada «${duplicate.key}».`);

  return {
    schemaVersion: 2,
    environmentPolicy: "LATEST_ACTIVE_ONLY",
    description: typeof value.description === "string" ? value.description : "",
    specifications,
  };
}

export async function loadKnowledgeGitSnapshot(projectRoot = PROJECT_ROOT): Promise<KnowledgeGitSnapshot> {
  const [officialRaw, specificationsRaw] = await Promise.all([
    parseJsonFile(projectRoot, OFFICIAL_MANIFEST),
    parseJsonFile(projectRoot, SPECIFICATIONS_MANIFEST),
  ]);
  const official = parseOfficialManifest(officialRaw);
  const specifications = parseSpecificationManifest(specificationsRaw);

  const documents: KnowledgeGitSnapshot["documents"] = [];
  for (const document of official.documents) {
    const path = absolutePath(projectRoot, document.gitPath);
    if (!await fileExists(path)) throw new Error(`Falta el documento oficial ${document.gitPath} [${document.key}].`);
    const bytes = await readFile(path);
    const checksum = sha256(bytes);
    if (checksum !== document.checksum) {
      throw new Error(`Checksum inválido para ${document.gitPath} [${document.key}]. Git=${document.checksum} archivo=${checksum}.`);
    }
    documents.push({ ...document, bytes });
  }

  const generationInstructions: KnowledgeGitSnapshot["generationInstructions"] = [];
  let indicatorVersion: KnowledgeGitSnapshot["indicatorVersion"] = null;

  for (const specification of specifications.specifications) {
    const path = absolutePath(projectRoot, specification.gitPath);
    if (!await fileExists(path)) throw new Error(`Falta la especificación ${specification.gitPath} [${specification.key}].`);
    const content = await readFile(path, "utf8");
    const checksum = sha256(content);
    if (checksum !== specification.checksum) {
      throw new Error(`Checksum inválido para ${specification.gitPath} [${specification.key}]. Git=${specification.checksum} archivo=${checksum}.`);
    }

    if (specification.sourceType === "GENERATION_INSTRUCTION") {
      generationInstructions.push({ ...specification, content });
      continue;
    }

    if (indicatorVersion) throw new Error(`${SPECIFICATIONS_MANIFEST}: existe más de una configuración activa de indicadores.`);
    const guideIndicators = specification.guideIndicators || [];
    const structureChecksum = guideIndicatorStructureChecksum(guideIndicators);
    if (!specification.structureChecksum || structureChecksum !== specification.structureChecksum) {
      throw new Error(`Checksum estructural inválido para ${INDICATOR_KEY}. Git=${specification.structureChecksum || "ausente"} estructura=${structureChecksum}.`);
    }
    const rendered = renderGuideIndicatorSpecification({
      version: specification.version,
      title: specification.title,
      indicators: guideIndicators,
    });
    if (sha256(rendered) !== specification.checksum || rendered !== content) {
      throw new Error(`La representación estructurada de ${INDICATOR_KEY} no coincide con ${specification.gitPath}.`);
    }
    indicatorVersion = {
      ...specification,
      guideIndicators,
      structureChecksum: specification.structureChecksum,
      content,
    };
  }

  return { projectRoot, documents, generationInstructions, indicatorVersion };
}

async function checksumStoredDocument(storagePath: string) {
  if (!storagePath.startsWith("knowledge/")) return null;
  try {
    const path = absolutePath(PROJECT_ROOT, storagePath);
    if (!await fileExists(path)) return null;
    return sha256(await readFile(path));
  } catch {
    return null;
  }
}

function conflictMessage(conflicts: RestoreConflict[]) {
  return [
    `No se restauró Conocimiento e IA porque se detectaron ${conflicts.length} conflicto(s).`,
    "El comando no sobrescribe silenciosamente versiones activas diferentes.",
    "",
    ...conflicts.flatMap((item) => [
      `[${item.scope}] ${item.key}`,
      `  ${item.message}`,
    ]),
  ].join("\n");
}

function effectiveFromDate(value: string | null) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) throw new Error(`Fecha efectiva inválida: ${value}`);
  return date;
}

function instructionChecksum(content: string) {
  return sha256(`${content.trim()}\n`);
}

function currentIndicatorChecksums(input: {
  version: number;
  title: string;
  indicators: GuideIndicatorManifestItem[];
}) {
  return {
    file: sha256(renderGuideIndicatorSpecification(input)),
    structure: guideIndicatorStructureChecksum(input.indicators),
  };
}

export async function restoreKnowledgeFromGit(): Promise<KnowledgeRestoreSummary> {
  const snapshot = await loadKnowledgeGitSnapshot();
  const conflicts: RestoreConflict[] = [];

  const documentPlans: Array<
    | { kind: "CREATE"; version: number; item: KnowledgeGitSnapshot["documents"][number] }
    | { kind: "ALIGN"; id: string; item: KnowledgeGitSnapshot["documents"][number] }
  > = [];

  for (const item of snapshot.documents) {
    const active = await database.knowledgeDocument.findMany({
      where: { key: item.key, status: "ACTIVE" },
      orderBy: { version: "desc" },
    });
    if (active.length > 1) {
      conflicts.push({ scope: "DOCUMENT", key: item.key, message: `hay ${active.length} versiones ACTIVE en PostgreSQL.` });
      continue;
    }
    if (active[0]) {
      const dbChecksum = active[0].checksum || await checksumStoredDocument(active[0].storagePath);
      if (dbChecksum !== item.checksum) {
        conflicts.push({
          scope: "DOCUMENT",
          key: item.key,
          message: `la versión ACTIVE de PostgreSQL no coincide con Git (BD=${dbChecksum || "sin checksum"}; Git=${item.checksum}).`,
        });
        continue;
      }
      documentPlans.push({ kind: "ALIGN", id: active[0].id, item });
      continue;
    }

    const latest = await database.knowledgeDocument.findFirst({
      where: { key: item.key },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    documentPlans.push({ kind: "CREATE", version: (latest?.version || 0) + 1, item });
  }

  const instructionPlans: Array<
    | { kind: "CREATE"; item: KnowledgeGitSnapshot["generationInstructions"][number] }
    | { kind: "REACTIVATE"; id: string; item: KnowledgeGitSnapshot["generationInstructions"][number] }
    | { kind: "ALIGN"; id: string; item: KnowledgeGitSnapshot["generationInstructions"][number] }
  > = [];

  for (const item of snapshot.generationInstructions) {
    const active = await database.generationInstruction.findMany({
      where: { key: item.key, status: "ACTIVE" },
      orderBy: { version: "desc" },
    });
    if (active.length > 1) {
      conflicts.push({ scope: "SPECIFICATION", key: item.key, message: `hay ${active.length} versiones ACTIVE en PostgreSQL.` });
      continue;
    }
    if (active[0]) {
      if (active[0].version !== item.version || instructionChecksum(active[0].content) !== item.checksum) {
        conflicts.push({
          scope: "SPECIFICATION",
          key: item.key,
          message: `la versión ACTIVE de PostgreSQL no coincide con Git (BD=v${active[0].version}; Git=v${item.version}).`,
        });
        continue;
      }
      instructionPlans.push({ kind: "ALIGN", id: active[0].id, item });
      continue;
    }

    const latest = await database.generationInstruction.findFirst({
      where: { key: item.key },
      orderBy: { version: "desc" },
    });
    if (latest && latest.version > item.version) {
      conflicts.push({
        scope: "SPECIFICATION",
        key: item.key,
        message: `PostgreSQL contiene una versión histórica más nueva (v${latest.version}) que Git (v${item.version}).`,
      });
      continue;
    }
    const exact = latest?.version === item.version
      ? latest
      : await database.generationInstruction.findFirst({ where: { key: item.key, version: item.version } });
    if (exact) {
      if (instructionChecksum(exact.content) !== item.checksum) {
        conflicts.push({ scope: "SPECIFICATION", key: item.key, message: `la versión histórica v${item.version} difiere del contenido almacenado en Git.` });
        continue;
      }
      instructionPlans.push({ kind: "REACTIVATE", id: exact.id, item });
    } else {
      instructionPlans.push({ kind: "CREATE", item });
    }
  }

  type IndicatorPlan =
    | { kind: "CREATE"; item: NonNullable<KnowledgeGitSnapshot["indicatorVersion"]> }
    | { kind: "REACTIVATE"; id: string; item: NonNullable<KnowledgeGitSnapshot["indicatorVersion"]> }
    | { kind: "UNCHANGED" };
  let indicatorPlan: IndicatorPlan | null = null;

  if (snapshot.indicatorVersion) {
    const item = snapshot.indicatorVersion;
    const active = await database.indicatorVersion.findMany({
      where: { status: "ACTIVE" },
      orderBy: { version: "desc" },
      include: { indicators: { orderBy: { sortOrder: "asc" } } },
    });
    if (active.length > 1) {
      conflicts.push({ scope: "INDICATORS", key: INDICATOR_KEY, message: `hay ${active.length} versiones ACTIVE en PostgreSQL.` });
    } else if (active[0]) {
      const dbIndicators: GuideIndicatorManifestItem[] = active[0].indicators.map((indicator) => ({
        code: indicator.code,
        name: indicator.name,
        description: indicator.description,
        stage: indicator.stage,
        score: Number(indicator.score),
        active: indicator.active,
        required: indicator.required,
        sortOrder: indicator.sortOrder,
      }));
      const checksums = currentIndicatorChecksums({ version: active[0].version, title: active[0].title, indicators: dbIndicators });
      if (active[0].version !== item.version || checksums.file !== item.checksum || checksums.structure !== item.structureChecksum) {
        conflicts.push({
          scope: "INDICATORS",
          key: INDICATOR_KEY,
          message: `la configuración ACTIVE de PostgreSQL no coincide con Git (BD=v${active[0].version}; Git=v${item.version}).`,
        });
      } else {
        indicatorPlan = { kind: "UNCHANGED" };
      }
    } else {
      const latest = await database.indicatorVersion.findFirst({
        orderBy: { version: "desc" },
        include: { indicators: { orderBy: { sortOrder: "asc" } } },
      });
      if (latest && latest.version > item.version) {
        conflicts.push({
          scope: "INDICATORS",
          key: INDICATOR_KEY,
          message: `PostgreSQL contiene una versión histórica más nueva (v${latest.version}) que Git (v${item.version}).`,
        });
      } else if (latest && latest.version === item.version) {
        const dbIndicators: GuideIndicatorManifestItem[] = latest.indicators.map((indicator) => ({
          code: indicator.code,
          name: indicator.name,
          description: indicator.description,
          stage: indicator.stage,
          score: Number(indicator.score),
          active: indicator.active,
          required: indicator.required,
          sortOrder: indicator.sortOrder,
        }));
        const checksums = currentIndicatorChecksums({ version: latest.version, title: latest.title, indicators: dbIndicators });
        if (checksums.file !== item.checksum || checksums.structure !== item.structureChecksum) {
          conflicts.push({ scope: "INDICATORS", key: INDICATOR_KEY, message: `la versión histórica v${item.version} difiere de Git.` });
        } else {
          indicatorPlan = { kind: "REACTIVATE", id: latest.id, item };
        }
      } else {
        indicatorPlan = { kind: "CREATE", item };
      }
    }
  }

  if (conflicts.length) throw new Error(conflictMessage(conflicts));

  const now = new Date();
  const summary: KnowledgeRestoreSummary = {
    documentsCreated: 0,
    documentsAligned: 0,
    instructionsCreated: 0,
    instructionsReactivated: 0,
    instructionsAligned: 0,
    indicatorCreated: false,
    indicatorReactivated: false,
    indicatorUnchanged: false,
  };

  await database.$transaction(async (tx) => {
    for (const plan of documentPlans) {
      const item = plan.item;
      const common = {
        title: item.title,
        status: "ACTIVE" as const,
        storagePath: item.gitPath,
        mimeType: item.mimeType,
        originalName: item.originalName,
        contentMarkdown: item.contentMarkdown,
        priority: item.priority,
        academicLevels: item.academicLevels,
        modalities: item.modalities,
        durations: item.durations,
        subjectTypes: item.subjectTypes,
        appliesToAll: item.appliesToAll,
        checksum: item.checksum,
        resourceKind: item.resourceKind,
        appliesToPlan: item.appliesToPlan,
        appliesToGuide: item.appliesToGuide,
        effectiveFrom: effectiveFromDate(item.effectiveFrom),
        provisional: item.provisional,
        retiredAt: null,
        retirementReason: null,
        retiredById: null,
      };
      if (plan.kind === "CREATE") {
        await tx.knowledgeDocument.create({
          data: {
            key: item.key,
            version: plan.version,
            activatedAt: now,
            ...common,
          },
        });
        summary.documentsCreated += 1;
      } else {
        await tx.knowledgeDocument.update({ where: { id: plan.id }, data: common });
        summary.documentsAligned += 1;
      }
    }

    for (const plan of instructionPlans) {
      const item = plan.item;
      const common = {
        title: item.title,
        content: item.content.trim(),
        status: "ACTIVE" as const,
        academicLevels: item.academicLevels,
        modalities: item.modalities,
        durations: item.durations,
        subjectTypes: item.subjectTypes,
        processes: item.processes,
        priority: item.priority ?? 100,
        retiredAt: null,
        retirementReason: null,
        retiredById: null,
      };
      if (plan.kind === "CREATE") {
        await tx.generationInstruction.create({
          data: {
            key: item.key,
            version: item.version,
            activatedAt: now,
            ...common,
          },
        });
        summary.instructionsCreated += 1;
      } else {
        await tx.generationInstruction.update({
          where: { id: plan.id },
          data: plan.kind === "REACTIVATE" ? { ...common, activatedAt: now } : common,
        });
        if (plan.kind === "REACTIVATE") summary.instructionsReactivated += 1;
        else summary.instructionsAligned += 1;
      }
    }

    if (indicatorPlan?.kind === "CREATE") {
      const item = indicatorPlan.item;
      await tx.indicatorVersion.create({
        data: {
          version: item.version,
          title: item.title,
          status: "ACTIVE",
          activatedAt: now,
          indicators: {
            create: item.guideIndicators.map((indicator) => ({
              code: indicator.code,
              name: indicator.name,
              description: indicator.description,
              stage: indicator.stage as never,
              score: indicator.score,
              active: indicator.active,
              required: indicator.required,
              sortOrder: indicator.sortOrder,
            })),
          },
        },
      });
      summary.indicatorCreated = true;
    } else if (indicatorPlan?.kind === "REACTIVATE") {
      await tx.indicatorVersion.update({
        where: { id: indicatorPlan.id },
        data: { status: "ACTIVE", activatedAt: now },
      });
      summary.indicatorReactivated = true;
    } else if (indicatorPlan?.kind === "UNCHANGED") {
      summary.indicatorUnchanged = true;
    }
  });

  return summary;
}
