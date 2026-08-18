import "dotenv/config";

import { database } from "../src/db/client.js";
import {
  inspectFunctionalSpecifications,
  inspectOfficialKnowledgeSources,
} from "../src/services/official-knowledge-sync.js";

try {
  const [checks, functional] = await Promise.all([
    inspectOfficialKnowledgeSources(),
    inspectFunctionalSpecifications(),
  ]);
  console.log("Estado de Conocimiento e IA para sincronización con Git:\n");
  console.log("DOCUMENTOS INSTITUCIONALES PARA IA");
  for (const item of checks) {
    const symbol = item.status === "MISSING" ? "FALTA" : item.status === "OFFICIAL_FALLBACK" ? "RECUPERABLE" : "OK";
    console.log(`[${symbol}] ${item.title} [${item.key}]`);
    console.log(`  BD: ${item.storagePath}`);
    console.log(`  Git: ${item.canonicalPath}`);
    if (item.originalName) console.log(`  Original: ${item.originalName}`);
  }
  const missing = checks.filter((item) => item.status === "MISSING");
  console.log(`\nDocumentos institucionales ACTIVE: ${checks.length} · faltantes: ${missing.length}`);

  console.log("\nESPECIFICACIONES FUNCIONALES");
  for (const item of functional.specifications) {
    console.log(`[OK] ${item.title} [${item.key}] · v${item.version}`);
    console.log(`  Git: ${item.gitPath}`);
  }
  if (functional.indicatorVersion) {
    console.log(`[OK] ${functional.indicatorVersion.title} [${functional.indicatorVersion.key}] · v${functional.indicatorVersion.version}`);
    console.log(`  Git: ${functional.indicatorVersion.gitPath}`);
  }
  console.log(`\nEspecificaciones funcionales ACTIVE: ${functional.specifications.length}${functional.indicatorVersion ? " + configuración activa de indicadores" : ""}`);

  if (missing.length) process.exitCode = 2;
} finally {
  await database.$disconnect();
}
