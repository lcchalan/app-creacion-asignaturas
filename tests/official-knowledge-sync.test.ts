import assert from "node:assert/strict";
import test from "node:test";

import {
  buildFunctionalSpecificationManifest,
  buildOfficialKnowledgeManifest,
  guideIndicatorStructureChecksum,
  canonicalFunctionalSpecificationPath,
  canonicalOfficialKnowledgePath,
  missingOfficialKnowledgeMessage,
  renderGuideIndicatorSpecification,
  type FunctionalSpecificationManifestItem,
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

test("las especificaciones funcionales usan una ruta canónica independiente", () => {
  assert.equal(
    canonicalFunctionalSpecificationPath("Adaptación Plan 16 a 8"),
    "knowledge/specifications/adaptacion-plan-16-a-8.txt",
  );
});

test("el manifiesto documental representa únicamente el estado vigente y queda ordenado", () => {
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

test("el manifiesto de especificaciones conserva solo la versión activa y ordena por clave", () => {
  const base: Omit<FunctionalSpecificationManifestItem, "key" | "title" | "version" | "gitPath" | "checksum"> = {
    sourceType: "GENERATION_INSTRUCTION",
    status: "ACTIVE",
    priority: 10,
    academicLevels: [],
    modalities: [],
    durations: [],
    subjectTypes: [],
    processes: ["GUIDE_GENERATION"],
  };
  const manifest = buildFunctionalSpecificationManifest([
    { ...base, key: "zeta", title: "Zeta", version: 3, gitPath: "knowledge/specifications/zeta.txt", checksum: "z" },
    { ...base, key: "alfa", title: "Alfa", version: 7, gitPath: "knowledge/specifications/alfa.txt", checksum: "a" },
  ]);
  assert.equal(manifest.environmentPolicy, "LATEST_ACTIVE_ONLY");
  assert.equal(manifest.schemaVersion, 2);
  assert.deepEqual(manifest.specifications.map((item) => item.key), ["alfa", "zeta"]);
  assert.equal(manifest.specifications[0]!.version, 7);
});

test("la configuración activa de indicadores se serializa de forma determinista para Git", () => {
  const content = renderGuideIndicatorSpecification({
    version: 4,
    title: "Indicadores institucionales",
    indicators: [
      { code: "EC-01", name: "Calidad", description: "Verifica calidad.", stage: "QUALITY", score: 3, active: true, required: true, sortOrder: 20 },
      { code: "PA-01", name: "Currículo", description: "Verifica currículo.", stage: "PEER", score: 4, active: true, required: false, sortOrder: 10 },
      { code: "DT-01", name: "Oculto", description: "No debe salir.", stage: "DIITEP", score: 1, active: false, required: true, sortOrder: 30 },
    ],
  });
  assert.match(content, /Versión activa: 4/);
  assert.ok(content.indexOf("PA-01") < content.indexOf("EC-01"));
  assert.match(content, /Responsable: Par académico/);
  assert.doesNotMatch(content, /DT-01/);
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


test("el respaldo de indicadores conserva también la estructura necesaria para restaurar PostgreSQL", () => {
  const indicators = [
    { code: "PA-01", name: "Currículo", description: "Verifica currículo.", stage: "PEER", score: 4, active: true, required: true, sortOrder: 10 },
    { code: "EC-01", name: "Calidad", description: "Criterio temporalmente deshabilitado.", stage: "QUALITY", score: 3, active: false, required: false, sortOrder: 20 },
  ];
  const checksum = guideIndicatorStructureChecksum(indicators);
  assert.equal(checksum.length, 64);
  assert.equal(checksum, guideIndicatorStructureChecksum([...indicators].reverse()));
});
