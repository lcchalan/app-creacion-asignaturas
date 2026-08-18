import "dotenv/config";

import { database } from "../src/db/client.js";
import { syncOfficialKnowledgeFromDatabase } from "../src/services/official-knowledge-sync.js";

try {
  const result = await syncOfficialKnowledgeFromDatabase();
  console.log("Conocimiento e IA sincronizado con Git.");
  console.log(`Documentos institucionales activos: ${result.documents}`);
  console.log(`Archivos oficiales copiados/actualizados: ${result.copied}`);
  console.log(`Recuperados desde knowledge/official: ${result.recoveredFromOfficial}`);
  console.log(`Registros de BD enlazados a knowledge/official: ${result.relinkedDatabaseRecords}`);
  console.log(`Archivos oficiales retirados: ${result.removed}`);
  console.log(`Manifiesto documental: ${result.manifestPath}`);
  console.log(`Especificaciones funcionales activas en Git: ${result.specifications}`);
  console.log(`Archivos de especificaciones escritos: ${result.specificationFilesWritten}`);
  console.log(`Archivos de especificaciones retirados: ${result.specificationFilesRemoved}`);
  console.log(`Manifiesto de especificaciones: ${result.specificationManifestPath}`);
} catch (error) {
  console.error("No se pudo sincronizar Conocimiento e IA con Git.");
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  await database.$disconnect();
}
