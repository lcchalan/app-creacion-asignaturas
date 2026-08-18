import "dotenv/config";

import { database } from "../src/db/client.js";
import { inspectOfficialKnowledgeSources } from "../src/services/official-knowledge-sync.js";

try {
  const checks = await inspectOfficialKnowledgeSources();
  console.log("Estado de archivos ACTIVE en Conocimiento e IA:\n");
  for (const item of checks) {
    const symbol = item.status === "MISSING" ? "FALTA" : item.status === "OFFICIAL_FALLBACK" ? "RECUPERABLE" : "OK";
    console.log(`[${symbol}] ${item.title} [${item.key}]`);
    console.log(`  BD: ${item.storagePath}`);
    console.log(`  Git: ${item.canonicalPath}`);
    if (item.originalName) console.log(`  Original: ${item.originalName}`);
  }
  const missing = checks.filter((item) => item.status === "MISSING");
  console.log(`\nTotal ACTIVE: ${checks.length} · faltantes: ${missing.length}`);
  if (missing.length) process.exitCode = 2;
} finally {
  await database.$disconnect();
}
