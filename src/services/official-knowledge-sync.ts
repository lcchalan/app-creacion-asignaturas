import { createHash } from "node:crypto";
import { access, copyFile, mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { database } from "../db/client.js";

const PROJECT_ROOT = fileURLToPath(new URL("../../", import.meta.url));
const OFFICIAL_DIR = join(PROJECT_ROOT, "knowledge", "official");
const MANIFEST_PATH = join(OFFICIAL_DIR, "manifest.json");
const MANAGED_STORAGE_PREFIXES = ["knowledge/uploads/", "knowledge/official/"];

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
  if (!normalized) throw new Error(`La clave de conocimiento «${value}» no permite construir un nombre oficial seguro.`);
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

function absoluteProjectPath(relativePath: string) {
  const absolute = resolve(PROJECT_ROOT, relativePath);
  const normalizedRoot = resolve(PROJECT_ROOT) + "/";
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
      "Documentos institucionales vigentes administrados desde Conocimiento e IA. En el ambiente de pruebas Git conserva únicamente la versión activa actual de cada clave.",
    documents: [...documents].sort((a, b) => a.key.localeCompare(b.key, "es")),
  };
}

async function previousManifest(): Promise<OfficialKnowledgeManifest | null> {
  try {
    return JSON.parse(await readFile(MANIFEST_PATH, "utf8")) as OfficialKnowledgeManifest;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return null;
    throw error;
  }
}

function isManagedKnowledgeStoragePath(storagePath: string) {
  return MANAGED_STORAGE_PREFIXES.some((prefix) => storagePath.startsWith(prefix));
}

async function activeManagedDocuments() {
  return database.knowledgeDocument.findMany({
    where: {
      status: "ACTIVE",
      OR: [
        { storagePath: { startsWith: "knowledge/uploads/" } },
        { storagePath: { startsWith: "knowledge/official/" } },
      ],
    },
    orderBy: [{ priority: "asc" }, { key: "asc" }],
  });
}

export async function inspectOfficialKnowledgeSources(): Promise<OfficialKnowledgeSourceCheck[]> {
  const documents = await activeManagedDocuments();
  const result: OfficialKnowledgeSourceCheck[] = [];

  for (const document of documents) {
    if (!isManagedKnowledgeStoragePath(document.storagePath)) continue;
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
    `No se puede sincronizar Conocimiento e IA porque faltan ${missing.length} archivo(s) físico(s) de documentos ACTIVE.`,
    details,
    "Vuelva a cargar esos documentos desde Administración > Conocimiento e IA, o reponga el archivo original en la ruta indicada por la BD.",
    "Después ejecute nuevamente: npm run knowledge:sync-official",
    "No se modificó el manifiesto ni se cambiaron las rutas de esos registros.",
  ].join("\n\n");
}

export async function syncOfficialKnowledgeFromDatabase() {
  await mkdir(OFFICIAL_DIR, { recursive: true });

  const documents = await activeManagedDocuments();
  const checks = await inspectOfficialKnowledgeSources();
  const missingMessage = missingOfficialKnowledgeMessage(checks);
  if (missingMessage) throw new Error(missingMessage);

  const statusById = new Map(checks.map((item) => [item.id, item]));
  const previous = await previousManifest();
  const currentPaths = new Set<string>();
  const manifestDocuments: OfficialKnowledgeManifestDocument[] = [];
  const canonicalUpdates: Array<{ id: string; storagePath: string; checksum: string }> = [];
  let copied = 0;
  let recoveredFromOfficial = 0;

  for (const document of documents) {
    if (!isManagedKnowledgeStoragePath(document.storagePath)) continue;

    const check = statusById.get(document.id);
    if (!check) continue;
    const canonicalPath = check.canonicalPath;
    const storedSourcePath = absoluteProjectPath(document.storagePath);
    const targetPath = absoluteProjectPath(canonicalPath);
    const sourcePath = check.status === "OFFICIAL_FALLBACK" ? targetPath : storedSourcePath;

    if (sourcePath !== targetPath) {
      await copyFile(sourcePath, targetPath);
      copied += 1;
    } else if (check.status === "OFFICIAL_FALLBACK") {
      recoveredFromOfficial += 1;
    }

    const bytes = await readFile(targetPath);
    const checksum = createHash("sha256").update(bytes).digest("hex");

    currentPaths.add(canonicalPath);
    canonicalUpdates.push({ id: document.id, storagePath: canonicalPath, checksum });
    manifestDocuments.push(
      manifestDocumentFrom({
        ...document,
        storagePath: canonicalPath,
        checksum,
      }),
    );
  }

  // Una vez que el archivo oficial existe, PostgreSQL pasa a apuntar a la ruta
  // versionada por Git. Así una clonación futura no depende de knowledge/uploads/.
  if (canonicalUpdates.length) {
    await database.$transaction(
      canonicalUpdates.map((item) => database.knowledgeDocument.update({
        where: { id: item.id },
        data: { storagePath: item.storagePath, checksum: item.checksum },
      })),
    );
  }

  const manifest = buildOfficialKnowledgeManifest(manifestDocuments);
  await writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

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

  return {
    ok: true as const,
    documents: manifest.documents.length,
    copied,
    recoveredFromOfficial,
    relinkedDatabaseRecords: canonicalUpdates.length,
    removed,
    manifestPath: "knowledge/official/manifest.json",
  };
}

export async function syncOfficialKnowledgeSafely(context: string) {
  try {
    return await syncOfficialKnowledgeFromDatabase();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[Conocimiento oficial] No se pudo sincronizar (${context}):`, error);
    return { ok: false as const, error: message };
  }
}
