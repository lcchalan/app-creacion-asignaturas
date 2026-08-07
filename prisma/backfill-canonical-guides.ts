import "dotenv/config";
import { createHash } from "node:crypto";
import { Prisma, PrismaClient } from "@prisma/client";
import {
  buildCanonicalGuide,
  CANONICAL_GUIDE_SCHEMA_VERSION,
} from "../src/canonical-guide.js";

const database = new PrismaClient();

async function main() {
  const projects = await database.project.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      matrix: { include: { rows: { orderBy: { rowOrder: "asc" } } } },
      weeks: { orderBy: { weekNumber: "asc" } },
      generatedImages: {
        orderBy: [{ weekNumber: "asc" }, { figureNumber: "asc" }],
      },
    },
  });

  let converted = 0;
  let skipped = 0;
  for (const project of projects) {
    if (!project.matrix?.rows.length) {
      skipped += 1;
      console.warn(`Omitido ${project.id}: no tiene una matriz con filas.`);
      continue;
    }

    try {
      const document = buildCanonicalGuide({
        project,
        matrix: project.matrix,
        weeks: project.weeks,
        generatedImages: project.generatedImages,
      });
      const checksum = createHash("sha256")
        .update(JSON.stringify(document))
        .digest("hex");
      await database.canonicalGuideDocument.upsert({
        where: { projectId: project.id },
        update: {
          schemaVersion: CANONICAL_GUIDE_SCHEMA_VERSION,
          document: document as unknown as Prisma.InputJsonValue,
          checksum,
        },
        create: {
          projectId: project.id,
          schemaVersion: CANONICAL_GUIDE_SCHEMA_VERSION,
          document: document as unknown as Prisma.InputJsonValue,
          checksum,
        },
      });
      converted += 1;
    } catch (error) {
      skipped += 1;
      const reason = error instanceof Error ? error.message : "error de validación desconocido";
      console.warn(`Omitido ${project.id}: ${reason}`);
    }
  }

  console.log(`Conversión finalizada: ${converted} guías convertidas; ${skipped} omitidas.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await database.$disconnect();
  });
