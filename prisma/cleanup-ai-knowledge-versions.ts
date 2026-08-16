import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const database = new PrismaClient();
const apply = process.argv.includes("--apply");

function sameIds(left: string[], right: string[]) {
  if (left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}

function retainedIds(ids: string[], activeIds: Set<string>) {
  return ids.filter((id) => activeIds.has(id));
}

async function main() {
  const [instructions, documents, indicatorVersions] = await Promise.all([
    database.generationInstruction.findMany({ orderBy: [{ key: "asc" }, { version: "desc" }] }),
    database.knowledgeDocument.findMany({ orderBy: [{ key: "asc" }, { version: "desc" }] }),
    database.indicatorVersion.findMany({
      orderBy: { version: "desc" },
      include: { indicators: { orderBy: { sortOrder: "asc" } }, reviews: { select: { id: true } } },
    }),
  ]);

  const activeInstructions = instructions.filter((item) => item.status === "ACTIVE");
  const inactiveInstructions = instructions.filter((item) => item.status !== "ACTIVE");
  const activeDocuments = documents.filter((item) => item.status === "ACTIVE");
  const inactiveDocuments = documents.filter((item) => item.status !== "ACTIVE");
  const activeIndicatorVersions = indicatorVersions.filter((item) => item.status === "ACTIVE");
  const removableIndicatorVersions = indicatorVersions.filter((item) =>
    item.status !== "ACTIVE" && item.reviews.length === 0);
  const protectedIndicatorVersions = indicatorVersions.filter((item) =>
    item.status !== "ACTIVE" && item.reviews.length > 0);

  const summary = {
    mode: apply ? "APPLY" : "DRY_RUN",
    specifications: {
      activeKept: activeInstructions.length,
      previousVersionsToDelete: inactiveInstructions.length,
    },
    documents: {
      activeKept: activeDocuments.length,
      previousVersionsToDelete: inactiveDocuments.length,
    },
    indicators: {
      activeVersionsKept: activeIndicatorVersions.length,
      previousVersionsToDelete: removableIndicatorVersions.length,
      historicalVersionsProtectedByReviews: protectedIndicatorVersions.length,
    },
  };

  console.log(JSON.stringify(summary, null, 2));
  console.log("\nEspecificaciones activas que se conservaran:");
  for (const item of activeInstructions) console.log(`- ${item.title} · v${item.version} [${item.key}]`);
  console.log("\nDocumentos activos que se conservaran:");
  for (const item of activeDocuments) console.log(`- ${item.title} · v${item.version} [${item.key}]`);
  if (protectedIndicatorVersions.length) {
    console.log("\nVersiones de indicadores inactivas que NO se eliminaran porque tienen revisiones asociadas:");
    for (const item of protectedIndicatorVersions) console.log(`- ${item.title} · v${item.version} (${item.reviews.length} revision(es))`);
  }

  if (!apply) {
    console.log("\nVista previa completada. Para ejecutar la limpieza use: npm run db:cleanup-ai-knowledge -- --apply");
    return;
  }

  const backupDir = join(process.cwd(), "backups");
  await mkdir(backupDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = join(backupDir, `ai-knowledge-before-cleanup-${stamp}.json`);
  await writeFile(backupPath, JSON.stringify({
    createdAt: new Date().toISOString(),
    generationInstructions: inactiveInstructions,
    knowledgeDocuments: inactiveDocuments,
    indicatorVersions: removableIndicatorVersions,
  }, null, 2), "utf8");

  const activeInstructionIds = new Set(activeInstructions.map((item) => item.id));
  const activeDocumentIds = new Set(activeDocuments.map((item) => item.id));
  const activeIndicatorIds = new Set(activeIndicatorVersions.map((item) => item.id));

  const [projects, proposals, teachingPlans] = await Promise.all([
    database.project.findMany({
      select: {
        id: true,
        specificationSnapshotIds: true,
        documentSnapshotIds: true,
        indicatorVersionSnapshotId: true,
      },
    }),
    database.adaptationProposal.findMany({
      select: { id: true, specificationSnapshotIds: true, documentSnapshotIds: true },
    }),
    database.teachingPlan.findMany({
      select: { id: true, templateSnapshotId: true, promptSnapshotId: true, documentSnapshotIds: true, specificationSnapshotIds: true },
    }),
  ]);

  await database.$transaction(async (transaction) => {
    for (const project of projects) {
      const nextSpecifications = retainedIds(project.specificationSnapshotIds, activeInstructionIds);
      const nextDocuments = retainedIds(project.documentSnapshotIds, activeDocumentIds);
      const nextIndicator = project.indicatorVersionSnapshotId && activeIndicatorIds.has(project.indicatorVersionSnapshotId)
        ? project.indicatorVersionSnapshotId
        : null;
      if (!sameIds(project.specificationSnapshotIds, nextSpecifications) ||
          !sameIds(project.documentSnapshotIds, nextDocuments) ||
          project.indicatorVersionSnapshotId !== nextIndicator) {
        await transaction.project.update({
          where: { id: project.id },
          data: {
            specificationSnapshotIds: nextSpecifications,
            documentSnapshotIds: nextDocuments,
            indicatorVersionSnapshotId: nextIndicator,
          },
        });
      }
    }

    for (const proposal of proposals) {
      const nextSpecifications = retainedIds(proposal.specificationSnapshotIds, activeInstructionIds);
      const nextDocuments = retainedIds(proposal.documentSnapshotIds, activeDocumentIds);
      if (!sameIds(proposal.specificationSnapshotIds, nextSpecifications) ||
          !sameIds(proposal.documentSnapshotIds, nextDocuments)) {
        await transaction.adaptationProposal.update({
          where: { id: proposal.id },
          data: { specificationSnapshotIds: nextSpecifications, documentSnapshotIds: nextDocuments },
        });
      }
    }

    for (const plan of teachingPlans) {
      const nextDocuments = retainedIds(plan.documentSnapshotIds, activeDocumentIds);
      const nextSpecifications = retainedIds(plan.specificationSnapshotIds, activeInstructionIds);
      const nextTemplate = plan.templateSnapshotId && activeDocumentIds.has(plan.templateSnapshotId)
        ? plan.templateSnapshotId
        : null;
      const nextPrompt = plan.promptSnapshotId && activeDocumentIds.has(plan.promptSnapshotId)
        ? plan.promptSnapshotId
        : null;
      if (!sameIds(plan.documentSnapshotIds, nextDocuments) ||
          !sameIds(plan.specificationSnapshotIds, nextSpecifications) ||
          plan.templateSnapshotId !== nextTemplate ||
          plan.promptSnapshotId !== nextPrompt) {
        await transaction.teachingPlan.update({
          where: { id: plan.id },
          data: {
            documentSnapshotIds: nextDocuments,
            specificationSnapshotIds: nextSpecifications,
            templateSnapshotId: nextTemplate,
            promptSnapshotId: nextPrompt,
          },
        });
      }
    }

    if (inactiveInstructions.length) {
      await transaction.generationInstruction.deleteMany({
        where: { id: { in: inactiveInstructions.map((item) => item.id) } },
      });
    }
    if (inactiveDocuments.length) {
      await transaction.knowledgeDocument.deleteMany({
        where: { id: { in: inactiveDocuments.map((item) => item.id) } },
      });
    }
    if (removableIndicatorVersions.length) {
      await transaction.indicatorVersion.deleteMany({
        where: { id: { in: removableIndicatorVersions.map((item) => item.id) } },
      });
    }
  });

  console.log(`\nLimpieza aplicada. Respaldo de metadatos: ${backupPath}`);
  console.log("Los archivos fisicos de conocimiento no se eliminan automaticamente; quedan como respaldo de seguridad fuera del catalogo activo.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await database.$disconnect();
  });
