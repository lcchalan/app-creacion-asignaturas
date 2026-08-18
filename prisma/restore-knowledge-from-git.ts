import "dotenv/config";

import { database } from "../src/db/client.js";
import { restoreKnowledgeFromGit } from "../src/services/knowledge-git-restore.js";

try {
  const result = await restoreKnowledgeFromGit();
  console.log("Restauración de Conocimiento e IA desde Git completada.");
  console.log("");
  console.log("Documentos institucionales para IA:");
  console.log(`  creados: ${result.documentsCreated}`);
  console.log(`  alineados/sin cambios de contenido: ${result.documentsAligned}`);
  console.log("");
  console.log("Especificaciones funcionales:");
  console.log(`  creadas: ${result.instructionsCreated}`);
  console.log(`  reactivadas: ${result.instructionsReactivated}`);
  console.log(`  alineadas/sin cambios de contenido: ${result.instructionsAligned}`);
  console.log("");
  console.log("Configuración de indicadores de la Guía Didáctica:");
  console.log(`  creada: ${result.indicatorCreated ? "sí" : "no"}`);
  console.log(`  reactivada: ${result.indicatorReactivated ? "sí" : "no"}`);
  console.log(`  sin cambios: ${result.indicatorUnchanged ? "sí" : "no"}`);
  console.log("");
  console.log("No se modificaron usuarios, catálogos, asignaciones, Planes Docentes, Guías Didácticas, revisiones, notificaciones ni auditoría.");
} catch (error) {
  console.error("No se pudo restaurar Conocimiento e IA desde Git.");
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  await database.$disconnect();
}
