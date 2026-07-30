ALTER TABLE "Project"
ADD COLUMN "subjectType" TEXT NOT NULL DEFAULT 'GENERAL',
ADD COLUMN "specificationSnapshotIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "documentSnapshotIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "indicatorVersionSnapshotId" UUID;

ALTER TABLE "GenerationInstruction"
ADD COLUMN "academicLevels" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "modalities" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "durations" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
ADD COLUMN "subjectTypes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "priority" INTEGER NOT NULL DEFAULT 100,
ADD COLUMN "impactAnalysis" JSONB,
ADD COLUMN "impactChecksum" TEXT;

ALTER TABLE "KnowledgeDocument"
ADD COLUMN "academicLevels" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "modalities" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "durations" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
ADD COLUMN "subjectTypes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "appliesToAll" BOOLEAN NOT NULL DEFAULT TRUE,
ADD COLUMN "impactAnalysis" JSONB,
ADD COLUMN "impactChecksum" TEXT;

CREATE INDEX "GenerationInstruction_status_priority_idx"
ON "GenerationInstruction"("status", "priority");

CREATE INDEX "KnowledgeDocument_status_appliesToAll_priority_idx"
ON "KnowledgeDocument"("status", "appliesToAll", "priority");
