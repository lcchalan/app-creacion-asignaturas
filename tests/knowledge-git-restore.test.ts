import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { loadKnowledgeGitSnapshot } from "../src/services/knowledge-git-restore.js";
import {
  buildFunctionalSpecificationManifest,
  buildOfficialKnowledgeManifest,
  guideIndicatorStructureChecksum,
  renderGuideIndicatorSpecification,
  type FunctionalSpecificationManifestItem,
  type GuideIndicatorManifestItem,
  type OfficialKnowledgeManifestDocument,
} from "../src/services/official-knowledge-sync.js";

function sha256(content: string | Buffer) {
  return createHash("sha256").update(content).digest("hex");
}

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "knowledge-restore-"));
  await mkdir(join(root, "knowledge/official"), { recursive: true });
  await mkdir(join(root, "knowledge/specifications"), { recursive: true });

  const officialContent = "Normas institucionales APA\n";
  const officialPath = "knowledge/official/normas-apa.txt";
  await writeFile(join(root, officialPath), officialContent, "utf8");
  const document: OfficialKnowledgeManifestDocument = {
    key: "normas-apa",
    title: "Normas APA",
    status: "ACTIVE",
    gitPath: officialPath,
    mimeType: "text/plain",
    originalName: "normas-apa.txt",
    checksum: sha256(officialContent),
    contentMarkdown: officialContent,
    priority: 50,
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
  await writeFile(
    join(root, "knowledge/official/manifest.json"),
    `${JSON.stringify(buildOfficialKnowledgeManifest([document]), null, 2)}\n`,
    "utf8",
  );

  const generationContent = "Regla funcional vigente.\n";
  const generationPath = "knowledge/specifications/especificacion-funcional.txt";
  await writeFile(join(root, generationPath), generationContent, "utf8");
  const generation: FunctionalSpecificationManifestItem = {
    sourceType: "GENERATION_INSTRUCTION",
    key: "especificacion-funcional",
    title: "Especificación funcional",
    version: 1,
    status: "ACTIVE",
    gitPath: generationPath,
    checksum: sha256(generationContent),
    priority: 10,
    academicLevels: [],
    modalities: [],
    durations: [],
    subjectTypes: [],
    processes: ["GUIDE_GENERATION"],
  };

  const indicators: GuideIndicatorManifestItem[] = [
    { code: "PA-01", name: "Currículo", description: "Revisar currículo.", stage: "PEER", score: 4, active: true, required: true, sortOrder: 10 },
    { code: "EC-01", name: "Calidad", description: "Criterio conservado aunque esté deshabilitado.", stage: "QUALITY", score: 3, active: false, required: false, sortOrder: 20 },
  ];
  const indicatorContent = renderGuideIndicatorSpecification({ version: 2, title: "Indicadores institucionales", indicators });
  const indicatorPath = "knowledge/specifications/indicadores-generales.txt";
  await writeFile(join(root, indicatorPath), indicatorContent, "utf8");
  const indicator: FunctionalSpecificationManifestItem = {
    sourceType: "GUIDE_INDICATOR_VERSION",
    key: "indicadores-generales",
    title: "Indicadores institucionales",
    version: 2,
    status: "ACTIVE",
    gitPath: indicatorPath,
    checksum: sha256(indicatorContent),
    priority: null,
    academicLevels: [],
    modalities: [],
    durations: [],
    subjectTypes: [],
    processes: ["GUIDE_REVIEW"],
    guideIndicators: indicators,
    structureChecksum: guideIndicatorStructureChecksum(indicators),
  };
  await writeFile(
    join(root, "knowledge/specifications/manifest.json"),
    `${JSON.stringify(buildFunctionalSpecificationManifest([generation, indicator]), null, 2)}\n`,
    "utf8",
  );

  return { root, officialPath };
}

test("Git contiene un snapshot autocontenido de Conocimiento e IA", async () => {
  const data = await fixture();
  try {
    const snapshot = await loadKnowledgeGitSnapshot(data.root);
    assert.equal(snapshot.documents.length, 1);
    assert.equal(snapshot.documents[0]!.key, "normas-apa");
    assert.equal(snapshot.generationInstructions.length, 1);
    assert.equal(snapshot.generationInstructions[0]!.key, "especificacion-funcional");
    assert.equal(snapshot.indicatorVersion?.version, 2);
    assert.equal(snapshot.indicatorVersion?.guideIndicators.length, 2);
    assert.equal(snapshot.indicatorVersion?.guideIndicators[1]!.active, false);
  } finally {
    await rm(data.root, { recursive: true, force: true });
  }
});

test("restore rechaza un archivo cuyo checksum no coincide con el manifiesto", async () => {
  const data = await fixture();
  try {
    await writeFile(join(data.root, data.officialPath), "contenido alterado\n", "utf8");
    await assert.rejects(() => loadKnowledgeGitSnapshot(data.root), /Checksum inválido/);
  } finally {
    await rm(data.root, { recursive: true, force: true });
  }
});

test("restore exige manifiesto de especificaciones v2 antes de considerar Git desplegable", async () => {
  const data = await fixture();
  try {
    const legacy = {
      schemaVersion: 1,
      environmentPolicy: "LATEST_ACTIVE_ONLY",
      description: "formato anterior",
      specifications: [],
    };
    await writeFile(join(data.root, "knowledge/specifications/manifest.json"), `${JSON.stringify(legacy, null, 2)}\n`, "utf8");
    await assert.rejects(() => loadKnowledgeGitSnapshot(data.root), /schemaVersion 2/);
  } finally {
    await rm(data.root, { recursive: true, force: true });
  }
});

test("restore verifica que estructura y archivo de indicadores representen la misma configuración", async () => {
  const data = await fixture();
  try {
    const manifestPath = join(data.root, "knowledge/specifications/manifest.json");
    const manifest = JSON.parse(await (await import("node:fs/promises")).readFile(manifestPath, "utf8"));
    const indicator = manifest.specifications.find((item: { key: string }) => item.key === "indicadores-generales");
    indicator.guideIndicators[0].description = "alteración no reflejada en el archivo";
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    await assert.rejects(() => loadKnowledgeGitSnapshot(data.root), /Checksum estructural inválido/);
  } finally {
    await rm(data.root, { recursive: true, force: true });
  }
});
