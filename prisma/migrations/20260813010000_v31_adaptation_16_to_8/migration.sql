-- v31: adaptación pedagógica trazable de documentos existentes de 16 semanas
-- al sistema modular de 8 semanas lectivas + recuperación.

CREATE TYPE "ProjectWorkflowMode" AS ENUM ('NEW', 'ADAPTATION_16_TO_8');
CREATE TYPE "LegacyDocumentType" AS ENUM ('PLAN_16_WEEKS', 'GUIDE_16_WEEKS');
CREATE TYPE "AdaptationTarget" AS ENUM ('PLAN', 'GUIDE');
CREATE TYPE "AdaptationProposalStatus" AS ENUM ('DRAFT', 'READY_FOR_REVIEW', 'APPROVED', 'SUPERSEDED');
CREATE TYPE "AdaptationAction" AS ENUM ('KEEP', 'GROUP', 'MERGE', 'SYNTHESIZE', 'MOVE', 'REFORMULATE', 'DELETE', 'SPLIT', 'UPDATE');
CREATE TYPE "AdaptationDecision" AS ENUM ('PENDING', 'ACCEPTED', 'EDITED', 'REJECTED', 'REGENERATE');

ALTER TABLE "Project"
  ADD COLUMN "workflowMode" "ProjectWorkflowMode",
  ADD COLUMN "adaptationPlanApprovedAt" TIMESTAMP(3),
  ADD COLUMN "adaptationGuideApprovedAt" TIMESTAMP(3);

-- Los proyectos que ya generaron un Plan Docente o iniciaron la Guía conservan
-- el flujo ordinario. Los proyectos que solo tienen revisión, perfil o bibliografía
-- permanecen sin modo para que el profesor pueda elegir adaptar documentos existentes.
UPDATE "Project" AS p
SET "workflowMode" = 'NEW'::"ProjectWorkflowMode"
WHERE EXISTS (SELECT 1 FROM "TeachingPlan" tp WHERE tp."projectId" = p."id")
   OR EXISTS (
     SELECT 1
     FROM "ProjectWeek" pw
     WHERE pw."projectId" = p."id"
       AND (pw."status" <> 'PENDING' OR pw."draftContent" IS NOT NULL OR pw."approvedContent" IS NOT NULL)
   );

CREATE TABLE "LegacyAcademicDocument" (
  "id" UUID NOT NULL,
  "projectId" UUID NOT NULL,
  "type" "LegacyDocumentType" NOT NULL,
  "originalName" TEXT NOT NULL,
  "storagePath" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "checksum" TEXT NOT NULL,
  "academicPeriod" TEXT,
  "versionLabel" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "uploadedById" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LegacyAcademicDocument_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LegacyAcademicDocument_projectId_type_active_idx"
  ON "LegacyAcademicDocument"("projectId", "type", "active");
CREATE UNIQUE INDEX "LegacyAcademicDocument_one_active_per_type_key"
  ON "LegacyAcademicDocument"("projectId", "type") WHERE "active" = true;
CREATE INDEX "LegacyAcademicDocument_uploadedById_createdAt_idx"
  ON "LegacyAcademicDocument"("uploadedById", "createdAt");

CREATE TABLE "AdaptationProposal" (
  "id" UUID NOT NULL,
  "projectId" UUID NOT NULL,
  "sourceDocumentId" UUID NOT NULL,
  "target" "AdaptationTarget" NOT NULL,
  "status" "AdaptationProposalStatus" NOT NULL DEFAULT 'DRAFT',
  "sourceWeeks" INTEGER NOT NULL DEFAULT 16,
  "targetWeeks" INTEGER NOT NULL DEFAULT 8,
  "title" TEXT NOT NULL,
  "overview" TEXT NOT NULL,
  "weeklyStructure" JSONB NOT NULL,
  "templateSnapshotId" UUID,
  "promptSnapshotId" UUID,
  "documentSnapshotIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "approvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AdaptationProposal_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AdaptationProposal_projectId_target_status_idx"
  ON "AdaptationProposal"("projectId", "target", "status");
CREATE INDEX "AdaptationProposal_sourceDocumentId_generatedAt_idx"
  ON "AdaptationProposal"("sourceDocumentId", "generatedAt");

CREATE TABLE "AdaptationChange" (
  "id" UUID NOT NULL,
  "proposalId" UUID NOT NULL,
  "sortOrder" INTEGER NOT NULL,
  "action" "AdaptationAction" NOT NULL,
  "sourceWeeks" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
  "sourceContent" TEXT NOT NULL,
  "proposedWeeks" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
  "proposedContent" TEXT NOT NULL,
  "rationale" TEXT NOT NULL,
  "learningOutcomes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "hoursImpact" TEXT NOT NULL,
  "evaluationImpact" TEXT NOT NULL,
  "institutionalSources" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "decision" "AdaptationDecision" NOT NULL DEFAULT 'PENDING',
  "teacherEditedContent" TEXT,
  "teacherComment" TEXT,
  "decidedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AdaptationChange_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AdaptationChange_proposalId_sortOrder_key"
  ON "AdaptationChange"("proposalId", "sortOrder");
CREATE INDEX "AdaptationChange_proposalId_decision_idx"
  ON "AdaptationChange"("proposalId", "decision");

ALTER TABLE "LegacyAcademicDocument"
  ADD CONSTRAINT "LegacyAcademicDocument_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LegacyAcademicDocument"
  ADD CONSTRAINT "LegacyAcademicDocument_uploadedById_fkey"
  FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AdaptationProposal"
  ADD CONSTRAINT "AdaptationProposal_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdaptationProposal"
  ADD CONSTRAINT "AdaptationProposal_sourceDocumentId_fkey"
  FOREIGN KEY ("sourceDocumentId") REFERENCES "LegacyAcademicDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AdaptationChange"
  ADD CONSTRAINT "AdaptationChange_proposalId_fkey"
  FOREIGN KEY ("proposalId") REFERENCES "AdaptationProposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
