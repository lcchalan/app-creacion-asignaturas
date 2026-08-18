import "dotenv/config";

import { database } from "../src/db/client.js";
import { syncOfficialKnowledgeFromDatabase } from "../src/services/official-knowledge-sync.js";

try {
  const result = await syncOfficialKnowledgeFromDatabase();
  console.log("Conocimiento oficial sincronizado con Git.");
  console.log(`Documentos activos: ${result.documents}`);
  console.log(`Archivos copiados/actualizados: ${result.copied}`);
  console.log(`Recuperados desde knowledge/official: ${result.recoveredFromOfficial}`);
  console.log(`Registros de BD enlazados a knowledge/official: ${result.relinkedDatabaseRecords}`);
  console.log(`Archivos oficiales retirados: ${result.removed}`);
  console.log(`Manifiesto: ${result.manifestPath}`);
} catch (error) {
  console.error("No se pudo sincronizar el conocimiento oficial.");
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  await database.$disconnect();
}
