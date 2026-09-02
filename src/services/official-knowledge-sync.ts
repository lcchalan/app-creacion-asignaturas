import { createHash } from "node:crypto";
import { access, copyFile, mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { database } from "../db/client.js";

const PROJECT_ROOT = fileURLToPath(new URL("../../", import.meta.url));
const KNOWLEDGE_DIR = join(PROJECT_ROOT, "knowledge");
const OFFICIAL_DIR = join(KNOWLEDGE_DIR, "official");
const SPECIFICATIONS_DIR = join(KNOWLEDGE_DIR, "specifications");
const OFFICIAL_MANIFEST_PATH = join(OFFICIAL_DIR, "manifest.json");
const SPECIFICATIONS_MANIFEST_PATH = join(SPECIFICATIONS_DIR, "manifest.json");
const LEGACY_INDICATOR_KEY = "indicadores-generales";

const MIME_EXTENSIONS: Record<string, string> = {
  "application/pdf": ".pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
  "text/markdown": ".md",
  "text/plain": ".txt",
};

export type OfficialKnowledgeManifestDocument = {
  key: string;
  title: string;
  status: "ACTIVE";
  gitPath: string;
  mimeType: string;
  originalName: string | null;
  checksum: string;
  contentMarkdown: string | null;
  priority: number;
  academicLevels: string[];
  modalities: string[];
  durations: number[];
  subjectTypes: string[];
  appliesToAll: boolean;
  resourceKind: string;
  appliesToPlan: boolean;
  appliesToGuide: boolean;
  effectiveFrom: string | null;
  provisional: boolean;
};

export type OfficialKnowledgeManifest = {
  schemaVersion: 1;
  environmentPolicy: "LATEST_ACTIVE_ONLY";
  description: string;
  documents: OfficialKnowledgeManifestDocument[];
};

export type GuideIndicatorManifestItem = {
  code: string;
  name: string;
  description: string;
  stage: string;
  score: number;
  active: boolean;
  required: boolean;
  sortOrder: number;
};

export type FunctionalSpecificationManifestItem = {
  sourceType: "GENERATION_INSTRUCTION" | "GUIDE_INDICATOR_VERSION";
  key: string;
  title: string;
  version: number;
  status: "ACTIVE";
  gitPath: string;
  checksum: string;
  priority: number | null;
  academicLevels: string[];
  modalities: string[];
  durations: number[];
  subjectTypes: string[];
  processes: string[];
  guideIndicators?: GuideIndicatorManifestItem[];
  structureChecksum?: string;
};

export type FunctionalSpecificationManifest = {
  schemaVersion: 2;
  environmentPolicy: "LATEST_ACTIVE_ONLY";
  description: string;
  specifications: FunctionalSpecificationManifestItem[];
};

export type OfficialKnowledgeSourceStatus = "AVAILABLE" | "OFFICIAL_FALLBACK" | "MISSING";

export type OfficialKnowledgeSourceCheck = {
  id: string;
  key: string;
  title: string;
  originalName: string | null;
  storagePath: string;
  canonicalPath: string;
  status: OfficialKnowledgeSourceStatus;
};

function safeKnowledgeKey(value: string) {
  const normalized = value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
  if (!normalized) throw new Error(`La clave de conocimiento «${value}» no permite construir un nombre seguro para Git.`);
  return normalized;
}

function extensionForKnowledgeDocument(mimeType: string, originalName: string | null, storagePath: string) {
  const originalExtension = extname(originalName || "").toLowerCase();
  if (/^\.[a-z0-9]{1,10}$/.test(originalExtension)) return originalExtension;
  const storageExtension = extname(storagePath).toLowerCase();
  if (/^\.[a-z0-9]{1,10}$/.test(storageExtension)) return storageExtension;
  return MIME_EXTENSIONS[mimeType] || ".bin";
}

export function canonicalOfficialKnowledgePath(input: {
  key: string;
  mimeType: string;
  originalName: string | null;
  storagePath: string;
}) {
  return `knowledge/official/${safeKnowledgeKey(input.key)}${extensionForKnowledgeDocument(
    input.mimeType,
    input.originalName,
    input.storagePath,
  )}`;
}

export function canonicalFunctionalSpecificationPath(key: string) {
  return `knowledge/specifications/${safeKnowledgeKey(key)}.txt`;
}

function absoluteProjectPath(relativePath: string) {
  const absolute = resolve(PROJECT_ROOT, relativePath);
  const normalizedRoot = `${resolve(PROJECT_ROOT)}/`;
  if (!absolute.startsWith(normalizedRoot)) {
    throw new Error(`Ruta de conocimiento fuera del proyecto: ${relativePath}`);
  }
  return absolute;
}

async function pathExists(path: string) {
  try {
    await access(path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

function normalizedStringArray(values: string[]) {
  return [...values].sort((a, b) => a.localeCompare(b, "es"));
}

function normalizedNumberArray(values: number[]) {
  return [...values].sort((a, b) => a - b);
}

function sha256(content: string | Buffer) {
  return createHash("sha256").update(content).digest("hex");
}

export function guideIndicatorStructureChecksum(indicators: GuideIndicatorManifestItem[]) {
  const normalized = [...indicators]
    .sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code, "es"))
    .map((indicator) => ({
      code: indicator.code,
      name: indicator.name,
      description: indicator.description,
      stage: indicator.stage,
      score: Number(indicator.score),
      active: Boolean(indicator.active),
      required: Boolean(indicator.required),
      sortOrder: indicator.sortOrder,
    }));
  return sha256(JSON.stringify(normalized));
}

function manifestDocumentFrom(input: {
  key: string;
  title: string;
  storagePath: string;
  mimeType: string;
  originalName: string | null;
  checksum: string;
  contentMarkdown: string | null;
  priority: number;
  academicLevels: string[];
  modalities: string[];
  durations: number[];
  subjectTypes: string[];
  appliesToAll: boolean;
  resourceKind: string;
  appliesToPlan: boolean;
  appliesToGuide: boolean;
  effectiveFrom: Date | null;
  provisional: boolean;
}): OfficialKnowledgeManifestDocument {
  return {
    key: input.key,
    title: input.title,
    status: "ACTIVE",
    gitPath: input.storagePath,
    mimeType: input.mimeType,
    originalName: input.originalName,
    checksum: input.checksum,
    contentMarkdown: input.contentMarkdown,
    priority: input.priority,
    academicLevels: normalizedStringArray(input.academicLevels),
    modalities: normalizedStringArray(input.modalities),
    durations: normalizedNumberArray(input.durations),
    subjectTypes: normalizedStringArray(input.subjectTypes),
    appliesToAll: input.appliesToAll,
    resourceKind: input.resourceKind,
    appliesToPlan: input.appliesToPlan,
    appliesToGuide: input.appliesToGuide,
    effectiveFrom: input.effectiveFrom ? input.effectiveFrom.toISOString().slice(0, 10) : null,
    provisional: input.provisional,
  };
}

export function buildOfficialKnowledgeManifest(
  documents: OfficialKnowledgeManifestDocument[],
): OfficialKnowledgeManifest {
  return {
    schemaVersion: 1,
    environmentPolicy: "LATEST_ACTIVE_ONLY",
    description:
      "Documentos institucionales vigentes administrados desde Conocimiento e IA. Git conserva únicamente la versión activa actual de cada clave; el historial permanece en PostgreSQL y en los commits de Git.",
    documents: [...documents].sort((a, b) => a.key.localeCompare(b.key, "es")),
  };
}

export function buildFunctionalSpecificationManifest(
  specifications: FunctionalSpecificationManifestItem[],
): FunctionalSpecificationManifest {
  return {
    schemaVersion: 2,
    environmentPolicy: "LATEST_ACTIVE_ONLY",
    description:
      "Especificaciones funcionales vigentes administradas desde Conocimiento e IA. Incluye las reglas de generación activas y la configuración activa de indicadores de la Guía Didáctica.",
    specifications: [...specifications].sort((a, b) => a.key.localeCompare(b.key, "es")),
  };
}

async function previousManifest<T>(path: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as T;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return null;
    throw error;
  }
}

function isKnowledgeStoragePath(storagePath: string) {
  return storagePath.startsWith("knowledge/");
}

async function activeManagedDocuments() {
  const documents = await database.knowledgeDocument.findMany({
    where: {
      status: "ACTIVE",
      key: { notIn: [LEGACY_INDICATOR_KEY, "especificacion-funcional"] },
    },
    orderBy: [{ priority: "asc" }, { key: "asc" }],
  });
  return documents.filter((document) => isKnowledgeStoragePath(document.storagePath));
}

async function activeFunctionalSpecifications() {
  return database.generationInstruction.findMany({
    where: { status: "ACTIVE" },
    orderBy: [{ priority: "asc" }, { key: "asc" }, { version: "desc" }],
  });
}

export async function inspectOfficialKnowledgeSources(): Promise<OfficialKnowledgeSourceCheck[]> {
  const documents = await activeManagedDocuments();
  const result: OfficialKnowledgeSourceCheck[] = [];

  for (const document of documents) {
    const canonicalPath = canonicalOfficialKnowledgePath(document);
    const sourcePath = absoluteProjectPath(document.storagePath);
    const targetPath = absoluteProjectPath(canonicalPath);
    const sourceAvailable = await pathExists(sourcePath);
    const officialAvailable = sourcePath !== targetPath && await pathExists(targetPath);

    result.push({
      id: document.id,
      key: document.key,
      title: document.title,
      originalName: document.originalName,
      storagePath: document.storagePath,
      canonicalPath,
      status: sourceAvailable ? "AVAILABLE" : officialAvailable ? "OFFICIAL_FALLBACK" : "MISSING",
    });
  }

  return result;
}

export function missingOfficialKnowledgeMessage(items: OfficialKnowledgeSourceCheck[]) {
  const missing = items.filter((item) => item.status === "MISSING");
  if (!missing.length) return "";
  const details = missing.map((item) =>
    `- ${item.title} [${item.key}]\n  BD: ${item.storagePath}\n  Git esperado: ${item.canonicalPath}\n  Archivo original: ${item.originalName || "sin nombre registrado"}`
  ).join("\n");
  return [
    `No se puede sincronizar Conocimiento e IA porque faltan ${missing.length} archivo(s) físico(s) de documentos institucionales ACTIVE.`,
    details,
    "Vuelva a cargar esos documentos desde Administración > Conocimiento e IA, o reponga el archivo original en la ruta indicada por la BD.",
    "Después ejecute nuevamente: npm run knowledge:sync-official",
    "No se modificaron los manifiestos ni se cambiaron las rutas de esos registros.",
  ].join("\n\n");
}

export function renderGuideIndicatorSpecification(input: {
  version: number;
  title: string;
  indicators: Array<{
    code: string;
    name: string;
    description: string;
    stage: string;
    score: unknown;
    active: boolean;
    required: boolean;
    sortOrder: number;
  }>;
}) {
  const stageLabels: Record<string, string> = {
    PEER: "Par académico",
    QUALITY: "Equipo de calidad",
    DIITEP: "DIITEP",
    DIRECTOR: "Dirección de carrera",
  };
  const active = [...input.indicators]
    .filter((item) => item.active)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  return [
    "INDICADORES GENERALES DE LA GUÍA DIDÁCTICA",
    `Versión activa: ${input.version}`,
    `Título: ${input.title}`,
    "",
    ...active.flatMap((indicator) => [
      `${indicator.code} · ${indicator.name}`,
      `Responsable: ${stageLabels[indicator.stage] || indicator.stage}`,
      `Puntuación: ${Number(indicator.score).toFixed(2)}`,
      `Obligatorio: ${indicator.required ? "Sí" : "No"}`,
      indicator.description.trim(),
      "",
    ]),
  ].join("\n").trimEnd() + "\n";
}

async function syncFunctionalSpecifications() {
  await mkdir(SPECIFICATIONS_DIR, { recursive: true });
  const previous = await previousManifest<FunctionalSpecificationManifest>(SPECIFICATIONS_MANIFEST_PATH);
  const currentPaths = new Set<string>();
  const items: FunctionalSpecificationManifestItem[] = [];
  let written = 0;

  const specifications = await activeFunctionalSpecifications();
  for (const specification of specifications) {
    const gitPath = canonicalFunctionalSpecificationPath(specification.key);
    const content = `${specification.content.trim()}\n`;
    await writeFile(absoluteProjectPath(gitPath), content, "utf8");
    const checksum = sha256(content);
    currentPaths.add(gitPath);
    written += 1;
    items.push({
      sourceType: "GENERATION_INSTRUCTION",
      key: specification.key,
      title: specification.title,
      version: specification.version,
      status: "ACTIVE",
      gitPath,
      checksum,
      priority: specification.priority,
      academicLevels: normalizedStringArray(specification.academicLevels),
      modalities: normalizedStringArray(specification.modalities),
      durations: normalizedNumberArray(specification.durations),
      subjectTypes: normalizedStringArray(specification.subjectTypes),
      processes: normalizedStringArray(specification.processes),
    });
  }

  const indicatorVersion = await database.indicatorVersion.findFirst({
    where: { status: "ACTIVE" },
    orderBy: { version: "desc" },
    include: { indicators: { orderBy: { sortOrder: "asc" } } },
  });
  if (indicatorVersion) {
    const gitPath = canonicalFunctionalSpecificationPath(LEGACY_INDICATOR_KEY);
    const guideIndicators: GuideIndicatorManifestItem[] = indicatorVersion.indicators.map((indicator) => ({
      code: indicator.code,
      name: indicator.name,
      description: indicator.description,
      stage: indicator.stage,
      score: Number(indicator.score),
      active: indicator.active,
      required: indicator.required,
      sortOrder: indicator.sortOrder,
    }));
    const content = renderGuideIndicatorSpecification({
      version: indicatorVersion.version,
      title: indicatorVersion.title,
      indicators: guideIndicators,
    });
    await writeFile(absoluteProjectPath(gitPath), content, "utf8");
    const checksum = sha256(content);
    currentPaths.add(gitPath);
    written += 1;
    items.push({
      sourceType: "GUIDE_INDICATOR_VERSION",
      key: LEGACY_INDICATOR_KEY,
      title: indicatorVersion.title,
      version: indicatorVersion.version,
      status: "ACTIVE",
      gitPath,
      checksum,
      priority: null,
      academicLevels: [],
      modalities: [],
      durations: [],
      subjectTypes: [],
      processes: ["GUIDE_REVIEW"],
      guideIndicators,
      structureChecksum: guideIndicatorStructureChecksum(guideIndicators),
    });
  }

  const manifest = buildFunctionalSpecificationManifest(items);
  await writeFile(SPECIFICATIONS_MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  let removed = 0;
  for (const oldItem of previous?.specifications || []) {
    if (!oldItem.gitPath.startsWith("knowledge/specifications/")) continue;
    if (oldItem.gitPath === "knowledge/specifications/manifest.json") continue;
    if (currentPaths.has(oldItem.gitPath)) continue;
    try {
      await unlink(absoluteProjectPath(oldItem.gitPath));
      removed += 1;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }

  return {
    specifications: manifest.specifications.length,
    written,
    removed,
    manifestPath: "knowledge/specifications/manifest.json",
  };
}

export async function syncOfficialKnowledgeFromDatabase() {
  await mkdir(OFFICIAL_DIR, { recursive: true });
  await mkdir(SPECIFICATIONS_DIR, { recursive: true });

  const documents = await activeManagedDocuments();
  const checks = await inspectOfficialKnowledgeSources();
  const missingMessage = missingOfficialKnowledgeMessage(checks);
  if (missingMessage) throw new Error(missingMessage);

  const statusById = new Map(checks.map((item) => [item.id, item]));
  const previous = await previousManifest<OfficialKnowledgeManifest>(OFFICIAL_MANIFEST_PATH);
  const currentPaths = new Set<string>();
  const manifestDocuments: OfficialKnowledgeManifestDocument[] = [];
  // V33.0.5.2: canonical Git copy must not replace historical storagePath
  let copied = 0;
  let recoveredFromOfficial = 0;

  for (const document of documents) {
    const check = statusById.get(document.id);
    if (!check) continue;
    const canonicalPath = check.canonicalPath;
    const storedSourcePath = absoluteProjectPath(document.storagePath);
    const targetPath = absoluteProjectPath(canonicalPath);
    const sourcePath = check.status === "OFFICIAL_FALLBACK" ? targetPath : storedSourcePath;

    const sourceBytes = await readFile(sourcePath);
    const sourceChecksum = sha256(sourceBytes);
    if (document.checksum && document.checksum !== sourceChecksum) {
      throw new Error(`El archivo fisico de «${document.title} · v${document.version}» no coincide con su checksum historico. BD=${document.checksum}; archivo=${sourceChecksum}; ruta=${document.storagePath}. No se sincronizara una version distinta hacia Git.`);
    }

    if (sourcePath !== targetPath) {
      await copyFile(sourcePath, targetPath);
      copied += 1;
    } else if (check.status === "OFFICIAL_FALLBACK") {
      recoveredFromOfficial += 1;
    }

    const bytes = sourcePath === targetPath ? sourceBytes : await readFile(targetPath);
    const checksum = sha256(bytes);

    currentPaths.add(canonicalPath);
    manifestDocuments.push(
      manifestDocumentFrom({
        ...document,
        storagePath: canonicalPath,
        checksum,
      }),
    );
  }

  const manifest = buildOfficialKnowledgeManifest(manifestDocuments);
  await writeFile(OFFICIAL_MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  let removed = 0;
  for (const oldDocument of previous?.documents || []) {
    if (!oldDocument.gitPath.startsWith("knowledge/official/")) continue;
    if (currentPaths.has(oldDocument.gitPath)) continue;
    try {
      await unlink(absoluteProjectPath(oldDocument.gitPath));
      removed += 1;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }

  const specificationSync = await syncFunctionalSpecifications();

  return {
    ok: true as const,
    documents: manifest.documents.length,
    copied,
    recoveredFromOfficial,
    relinkedDatabaseRecords: 0,
    removed,
    manifestPath: "knowledge/official/manifest.json",
    specifications: specificationSync.specifications,
    specificationFilesWritten: specificationSync.written,
    specificationFilesRemoved: specificationSync.removed,
    specificationManifestPath: specificationSync.manifestPath,
  };
}

export async function inspectFunctionalSpecifications() {
  const [specifications, indicatorVersion] = await Promise.all([
    activeFunctionalSpecifications(),
    database.indicatorVersion.findFirst({
      where: { status: "ACTIVE" },
      orderBy: { version: "desc" },
      select: { version: true, title: true },
    }),
  ]);
  return {
    specifications: specifications.map((item) => ({
      key: item.key,
      title: item.title,
      version: item.version,
      gitPath: canonicalFunctionalSpecificationPath(item.key),
    })),
    indicatorVersion: indicatorVersion ? {
      key: LEGACY_INDICATOR_KEY,
      title: indicatorVersion.title,
      version: indicatorVersion.version,
      gitPath: canonicalFunctionalSpecificationPath(LEGACY_INDICATOR_KEY),
    } : null,
  };
}

export async function syncOfficialKnowledgeSafely(context: string) {
  try {
    return await syncOfficialKnowledgeFromDatabase();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[Conocimiento Git] No se pudo sincronizar (${context}):`, error);
    return { ok: false as const, error: message };
  }
}
