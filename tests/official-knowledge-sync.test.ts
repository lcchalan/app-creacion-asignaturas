import assert from "node:assert/strict";
import test from "node:test";

import {
  buildOfficialKnowledgeManifest,
  canonicalOfficialKnowledgePath,
  missingOfficialKnowledgeMessage,
  type OfficialKnowledgeManifestDocument,
} from "../src/services/official-knowledge-sync.js";

test("conocimiento oficial usa una ruta canónica sin número de versión", () => {
  assert.equal(
    canonicalOfficialKnowledgePath({
      key: "lineamientos-sistema-modular",
      mimeType: "application/pdf",
      originalName: "Lineamientos_Sistema_Modular_En_Linea.pdf",
      storagePath: "knowledge/uploads/lineamientos-sistema-modular-v7-documento.pdf",
    }),
    "knowledge/official/lineamientos-sistema-modular.pdf",
  );
});

test("el manifiesto representa únicamente el estado vigente y queda ordenado", () => {
  const base: Omit<OfficialKnowledgeManifestDocument, "key" | "title" | "gitPath" | "checksum"> = {
    status: "ACTIVE",
    mimeType: "application/pdf",
    originalName: null,
    contentMarkdown: null,
    priority: 20,
    academicLevels: [],
    modalities: [],
    durations: [],
    subjectTypes: [],
    appliesToAll: true,
    resourceKind: "INSTITUTIONAL_DOCUMENT",
    appliesToPlan: true,
    appliesToGuide: true,
    effectiveFrom: null,
    provisional: false,
  };
  const manifest = buildOfficialKnowledgeManifest([
    { ...base, key: "zeta", title: "Zeta", gitPath: "knowledge/official/zeta.pdf", checksum: "z" },
    { ...base, key: "alfa", title: "Alfa", gitPath: "knowledge/official/alfa.pdf", checksum: "a" },
  ]);

  assert.equal(manifest.environmentPolicy, "LATEST_ACTIVE_ONLY");
  assert.deepEqual(manifest.documents.map((item) => item.key), ["alfa", "zeta"]);
  assert.equal("version" in manifest.documents[0]!, false);
});

test("un archivo ACTIVE faltante produce un diagnóstico accionable", () => {
  const message = missingOfficialKnowledgeMessage([
    {
      id: "1",
      key: "mcaces",
      title: "Modelo genérico para la evaluación del entorno",
      originalName: "Modelo.pdf",
      storagePath: "knowledge/uploads/MCACES-v1-Modelo.pdf",
      canonicalPath: "knowledge/official/mcaces.pdf",
      status: "MISSING",
    },
  ]);
  assert.match(message, /faltan 1 archivo\(s\)/);
  assert.match(message, /knowledge\/uploads\/MCACES-v1-Modelo\.pdf/);
  assert.match(message, /knowledge\/official\/mcaces\.pdf/);
  assert.match(message, /knowledge:sync-official/);
});
