import "dotenv/config";

import { access, readFile, unlink, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

import { database } from "../src/db/client.js";
import {
  canonicalFunctionalSpecificationPath,
  syncOfficialKnowledgeFromDatabase,
} from "../src/services/official-knowledge-sync.js";

const PROJECT_ROOT = fileURLToPath(new URL("../", import.meta.url));

function projectPath(relativePath: string) {
  const absolute = resolve(PROJECT_ROOT, relativePath);
  const normalizedRoot = `${resolve(PROJECT_ROOT)}/`;
  if (!absolute.startsWith(normalizedRoot)) throw new Error(`Ruta fuera del proyecto: ${relativePath}`);
  return absolute;
}

async function exists(relativePath: string) {
  try {
    await access(projectPath(relativePath));
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}


async function normalizeLegacyText(relativePath: string) {
  if (!(await exists(relativePath))) return;
  const original = await readFile(projectPath(relativePath), "utf8");
  const normalized = `${original.split(/\r?\n/).map((line) => line.trimEnd()).join("\n").trimEnd()}\n`;
  if (normalized !== original) await writeFile(projectPath(relativePath), normalized, "utf8");
}

async function legacyText(fileName: string) {
  const relativePath = `knowledge/${fileName}`;
  if (!(await exists(relativePath))) return "";
  return (await readFile(projectPath(relativePath), "utf8")).trim();
}

async function ensureGenericFunctionalSpecification() {
  const key = "especificacion-funcional";
  const [activeInstruction, latestInstruction, activeLegacyDocument, latestLegacyDocument] = await Promise.all([
    database.generationInstruction.findFirst({ where: { key, status: "ACTIVE" }, orderBy: { version: "desc" } }),
    database.generationInstruction.findFirst({ where: { key }, orderBy: { version: "desc" } }),
    database.knowledgeDocument.findFirst({ where: { key, status: "ACTIVE" }, orderBy: { version: "desc" } }),
    database.knowledgeDocument.findFirst({ where: { key }, orderBy: { version: "desc" } }),
  ]);

  let resolvedActiveInstruction = activeInstruction;
  const shouldMigrateActiveLegacy = !resolvedActiveInstruction && Boolean(activeLegacyDocument);
  const shouldSeedFromTrackedFile = !resolvedActiveInstruction && !latestInstruction && !latestLegacyDocument;
  if (shouldMigrateActiveLegacy || shouldSeedFromTrackedFile) {
    const sourceDocument = activeLegacyDocument || latestLegacyDocument;
    const content = sourceDocument?.contentMarkdown?.trim() || await legacyText("especificacion-funcional-v1.txt");
    if (!content) {
      throw new Error("No se encontró contenido para normalizar «especificacion-funcional». Se conserva la estructura anterior sin eliminar archivos.");
    }
    resolvedActiveInstruction = await database.generationInstruction.create({
      data: {
        key,
        title: sourceDocument?.title || "Especificación funcional",
        content,
        version: (latestInstruction?.version ?? 0) + 1,
        status: "ACTIVE",
        academicLevels: sourceDocument?.academicLevels || [],
        modalities: sourceDocument?.modalities || [],
        durations: sourceDocument?.durations || [],
        subjectTypes: sourceDocument?.subjectTypes || [],
        processes: ["GUIDE_GENERATION", "GUIDE_ADAPTATION"],
        priority: sourceDocument?.priority ?? 10,
        activatedAt: sourceDocument?.activatedAt ?? new Date(),
        createdById: sourceDocument?.createdById ?? null,
      },
    });
    console.log("Creada Especificación funcional activa desde el recurso heredado.");
  }

  if (!resolvedActiveInstruction) {
    console.warn("No hay una Especificación funcional activa. No se archivará automáticamente el recurso heredado para respetar la configuración administrativa actual.");
    return;
  }

  const activeLegacyDocuments = await database.knowledgeDocument.findMany({
    where: { key, status: { not: "ARCHIVED" } },
    select: { id: true },
  });
  if (activeLegacyDocuments.length) {
    await database.knowledgeDocument.updateMany({
      where: { key, status: { not: "ARCHIVED" } },
      data: {
        status: "ARCHIVED",
        retiredAt: new Date(),
        retirementReason: "Normalizado como Especificación funcional administrada por GenerationInstruction (v32.4.2).",
      },
    });
    console.log(`Archivados ${activeLegacyDocuments.length} registro(s) heredado(s) de «especificacion-funcional» en KnowledgeDocument.`);
  }
}

async function ensurePlanAdaptationSpecification() {
  const key = "adaptacion-plan-16-a-8";
  const existing = await database.generationInstruction.findFirst({
    where: { key },
    orderBy: { version: "desc" },
  });
  if (existing) return;

  const content = await legacyText("especificacion-adaptacion-plan-16-a-8-v1.txt");
  if (!content) {
    console.warn("No se encontró especificacion-adaptacion-plan-16-a-8-v1.txt y no existe la especificación en BD; se conserva el estado actual.");
    return;
  }
  await database.generationInstruction.create({
    data: {
      key,
      title: "Reestructuración pedagógica del Plan Docente 16 → 8 semanas",
      content,
      version: 1,
      status: "ACTIVE",
      durations: [8],
      processes: ["PLAN_ADAPTATION"],
      priority: 5,
      activatedAt: new Date(),
    },
  });
  console.log("Creada la Especificación funcional de adaptación 16 → 8 desde el archivo heredado.");
}

async function canRemoveInstitutionalLegacy(key: string) {
  const document = await database.knowledgeDocument.findFirst({
    where: { key, status: "ACTIVE" },
    orderBy: { version: "desc" },
    select: { storagePath: true },
  });
  return Boolean(document?.storagePath.startsWith("knowledge/official/") && await exists(document.storagePath));
}

async function canRemoveSpecificationLegacy(key: string) {
  const instruction = await database.generationInstruction.findFirst({
    where: { key, status: "ACTIVE" },
    orderBy: { version: "desc" },
    select: { id: true },
  });
  const canonical = canonicalFunctionalSpecificationPath(key);
  return Boolean(instruction && await exists(canonical));
}

async function removeLegacyFile(relativePath: string, allowed: boolean) {
  if (!(await exists(relativePath))) return false;
  if (!allowed) {
    console.warn(`Se conserva ${relativePath}: no se pudo demostrar que exista una copia canónica activa.`);
    return false;
  }
  await unlink(projectPath(relativePath));
  console.log(`Retirado archivo heredado: ${relativePath}`);
  return true;
}

async function main() {
  for (const relativePath of [
    "knowledge/normas-apa.txt",
    "knowledge/indicaciones-rea.txt",
    "knowledge/metodologias-activas.txt",
    "knowledge/especificacion-funcional-v1.txt",
    "knowledge/especificacion-adaptacion-plan-16-a-8-v1.txt",
    "knowledge/indicadores-generales.txt",
  ]) {
    await normalizeLegacyText(relativePath);
  }

  await ensureGenericFunctionalSpecification();
  await ensurePlanAdaptationSpecification();

  const result = await syncOfficialKnowledgeFromDatabase();
  console.log(`Sincronización: ${result.documents} documentos institucionales y ${result.specifications} especificaciones/configuraciones activas.`);

  await removeLegacyFile("knowledge/normas-apa.txt", await canRemoveInstitutionalLegacy("normas-apa"));
  await removeLegacyFile("knowledge/indicaciones-rea.txt", await canRemoveInstitutionalLegacy("indicaciones-rea"));
  await removeLegacyFile("knowledge/metodologias-activas.txt", await canRemoveInstitutionalLegacy("metodologias-activas"));
  await removeLegacyFile("knowledge/especificacion-funcional-v1.txt", await canRemoveSpecificationLegacy("especificacion-funcional"));
  await removeLegacyFile("knowledge/especificacion-adaptacion-plan-16-a-8-v1.txt", await canRemoveSpecificationLegacy("adaptacion-plan-16-a-8"));

  const activeIndicators = await database.indicatorVersion.findFirst({
    where: { status: "ACTIVE" },
    orderBy: { version: "desc" },
    select: { id: true },
  });
  const indicatorCanonical = canonicalFunctionalSpecificationPath("indicadores-generales");
  await removeLegacyFile(
    "knowledge/indicadores-generales.txt",
    Boolean(activeIndicators && await exists(indicatorCanonical)),
  );

  console.log("\nNormalización de Conocimiento e IA completada.");
  console.log("- Documentos institucionales: knowledge/official/");
  console.log("- Especificaciones funcionales: knowledge/specifications/");
  console.log("- Cargas temporales: knowledge/uploads/ (fuera de Git)");
}

main()
  .catch((error) => {
    console.error("No se pudo normalizar la estructura de Conocimiento e IA.");
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await database.$disconnect();
  });
