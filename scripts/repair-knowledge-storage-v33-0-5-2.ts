import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { database } from "../src/db/client.js";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const UPLOADS = resolve(ROOT, "knowledge/uploads");
const APPLY = process.argv.includes("--apply");

function sha256(bytes: Buffer) {
  return createHash("sha256").update(bytes).digest("hex");
}

function safe(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_");
}

async function fileHash(path: string) {
  return sha256(await readFile(path));
}

async function main() {
  await mkdir(UPLOADS, { recursive: true });
  const entries = await readdir(UPLOADS, { withFileTypes: true });
  const uploadFiles = entries.filter((entry) => entry.isFile()).map((entry) => entry.name);
  const hashToFiles = new Map<string, string[]>();
  for (const name of uploadFiles) {
    const relativePath = `knowledge/uploads/${name}`;
    const checksum = await fileHash(resolve(ROOT, relativePath));
    const current = hashToFiles.get(checksum) || [];
    current.push(relativePath);
    hashToFiles.set(checksum, current);
  }

  const documents = await database.knowledgeDocument.findMany({
    where: { storagePath: { startsWith: "knowledge/official/" } },
    orderBy: [{ key: "asc" }, { version: "asc" }],
  });

  const repairs: Array<{
    id: string; key: string; version: number; from: string; to: string; checksum: string;
    recoverySource: string | null;
  }> = [];
  const unresolved: string[] = [];

  for (const document of documents) {
    if (!document.checksum) {
      unresolved.push(`${document.key} v${document.version}: sin checksum historico.`);
      continue;
    }

    const matches = hashToFiles.get(document.checksum) || [];
    const versionMarker = new RegExp(`-v${document.version}(?:-|\\.)`, "i");
    const versionMatches = matches.filter((path) => versionMarker.test(path));
    let target = versionMatches.length === 1 ? versionMatches[0] : matches.length === 1 ? matches[0] : null;
    let recoverySource: string | null = null;

    if (!target && matches.length > 1) {
      const original = safe(document.originalName || "");
      const nameMatches = versionMatches.filter((path) => !original || path.endsWith(original));
      if (nameMatches.length === 1) target = nameMatches[0];
    }

    if (!target) {
      const canonicalAbsolute = resolve(ROOT, document.storagePath);
      try {
        const canonicalChecksum = await fileHash(canonicalAbsolute);
        if (canonicalChecksum === document.checksum) {
          const safeKey = safe(document.key) || "knowledge";
          const safeName = safe(document.originalName || `${document.key}.bin`);
          target = `knowledge/uploads/${safeKey}-recovered-v${document.version}-${document.checksum.slice(0, 16)}-${safeName}`;
          recoverySource = document.storagePath;
        }
      } catch {
        // Se reporta como no resuelto debajo.
      }
    }

    if (!target) {
      unresolved.push(`${document.key} v${document.version}: no se encontro una copia historica inequívoca para checksum ${document.checksum}.`);
      continue;
    }

    repairs.push({
      id: document.id, key: document.key, version: document.version, from: document.storagePath,
      to: target, checksum: document.checksum, recoverySource,
    });
  }

  console.log(`[v33.0.5.2] Registros con ruta canonica: ${documents.length}`);
  console.log(`[v33.0.5.2] Reparaciones seguras detectadas: ${repairs.length}`);
  for (const repair of repairs) {
    console.log(`  - ${repair.key} v${repair.version}: ${repair.from} -> ${repair.to}${repair.recoverySource ? " (copiar desde canonical actual)" : ""}`);
  }
  if (unresolved.length) {
    console.log(`[v33.0.5.2] No resueltos: ${unresolved.length}`);
    for (const item of unresolved) console.log(`  - ${item}`);
  }

  if (!APPLY) {
    console.log("[v33.0.5.2] Modo diagnostico. No se modifico PostgreSQL ni se copiaron archivos.");
    console.log("[v33.0.5.2] Para aplicar solo las reparaciones seguras, ejecute nuevamente con --apply.");
    return;
  }

  for (const repair of repairs) {
    const targetAbsolute = resolve(ROOT, repair.to);
    if (repair.recoverySource) {
      const sourceAbsolute = resolve(ROOT, repair.recoverySource);
      const sourceChecksum = await fileHash(sourceAbsolute);
      if (sourceChecksum !== repair.checksum) throw new Error(`Cambio detectado antes de copiar ${repair.key} v${repair.version}.`);
      await copyFile(sourceAbsolute, targetAbsolute);
    }
    const targetChecksum = await fileHash(targetAbsolute);
    if (targetChecksum !== repair.checksum) {
      throw new Error(`Checksum invalido para ${repair.key} v${repair.version}: esperado ${repair.checksum}; archivo ${targetChecksum}.`);
    }
  }

  await database.$transaction(
    repairs.map((repair) => database.knowledgeDocument.update({
      where: { id: repair.id },
      data: { storagePath: repair.to },
    })),
  );

  console.log(`[v33.0.5.2] Reparacion aplicada a ${repairs.length} registro(s).`);
  console.log("[v33.0.5.2] No se modificaron checksum, estados, versiones ni archivos de knowledge/official.");
}

main()
  .catch((error) => {
    console.error("[v33.0.5.2] ERROR:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await database.$disconnect();
  });
