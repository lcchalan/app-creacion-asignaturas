import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { readFile } from "node:fs/promises";

const database = new PrismaClient();
const key = "adaptacion-plan-16-a-8";

async function main() {
  const existing = await database.generationInstruction.findFirst({
    where: { key },
    orderBy: { version: "desc" },
  });
  if (existing) {
    console.log(`La Especificaci\u00f3n funcional ya existe: ${existing.title} · v${existing.version} · ${existing.status}. No se realizaron cambios.`);
    return;
  }

  const content = await readFile(
    new URL("../knowledge/specifications/adaptacion-plan-16-a-8.txt", import.meta.url),
    "utf8",
  );
  const created = await database.generationInstruction.create({
    data: {
      key,
      title: "Reestructuraci\u00f3n pedag\u00f3gica del Plan Docente 16 \u2192 8 semanas",
      content,
      version: 1,
      status: "ACTIVE",
      durations: [8],
      processes: ["PLAN_ADAPTATION"],
      priority: 5,
      activatedAt: new Date(),
    },
  });
  console.log(`Especificaci\u00f3n funcional creada y activada: ${created.title} · v${created.version}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await database.$disconnect();
  });
