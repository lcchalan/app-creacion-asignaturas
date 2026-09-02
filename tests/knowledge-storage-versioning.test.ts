import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const syncFile = new URL("../src/services/official-knowledge-sync.ts", import.meta.url);
const restoreFile = new URL("../src/services/knowledge-git-restore.ts", import.meta.url);
const repairFile = new URL("../scripts/repair-knowledge-storage-v33-0-5-2.ts", import.meta.url);

test("la sincronizacion oficial no reemplaza el storagePath historico por la ruta canonica", async () => {
  const source = await readFile(syncFile, "utf8");
  assert.ok(source.includes("V33.0.5.2: canonical Git copy must not replace historical storagePath"));
  assert.equal(source.includes("canonicalUpdates.push({ id: document.id, storagePath: canonicalPath, checksum })"), false);
  assert.equal(source.includes("data: { storagePath: item.storagePath, checksum: item.checksum }"), false);
  assert.ok(source.includes("relinkedDatabaseRecords: 0"));
});

test("la sincronizacion bloquea un archivo fisico cuyo checksum no corresponde a la version registrada", async () => {
  const source = await readFile(syncFile, "utf8");
  assert.ok(source.includes("const sourceChecksum = sha256(sourceBytes);"));
  assert.ok(source.includes("document.checksum !== sourceChecksum"));
  assert.ok(source.includes("No se sincronizara una version distinta hacia Git"));
});

test("la restauracion materializa el documento Git en knowledge/uploads antes de persistirlo", async () => {
  const source = await readFile(restoreFile, "utf8");
  assert.ok(source.includes("V33.0.5.2: restore Git snapshot into immutable local storage"));
  assert.ok(source.includes("restoredDocumentStoragePaths"));
  assert.ok(source.includes("knowledge/uploads/"));
  assert.ok(source.includes("await writeFile(targetPath, item.bytes);"));
  assert.ok(source.includes("storagePath: restoredDocumentStoragePaths.get(item.key)!"));
  assert.equal(source.includes("storagePath: item.gitPath,"), false);
});

test("la reparacion es diagnostica por defecto y solo cambia storagePath con --apply", async () => {
  const source = await readFile(repairFile, "utf8");
  assert.ok(source.includes('process.argv.includes("--apply")'));
  assert.ok(source.includes("Modo diagnostico"));
  assert.ok(source.includes("targetChecksum !== repair.checksum"));
  assert.ok(source.includes("data: { storagePath: repair.to }"));
  assert.equal(source.includes("data: { storagePath: repair.to, checksum:"), false);
});
