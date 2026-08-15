ALTER TABLE "GenerationInstruction"
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "retiredAt" TIMESTAMP(3),
  ADD COLUMN "retirementReason" TEXT,
  ADD COLUMN "retiredById" UUID;

ALTER TABLE "KnowledgeDocument"
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "retiredAt" TIMESTAMP(3),
  ADD COLUMN "retirementReason" TEXT,
  ADD COLUMN "retiredById" UUID;

CREATE INDEX "GenerationInstruction_retiredById_idx" ON "GenerationInstruction"("retiredById");
CREATE INDEX "KnowledgeDocument_retiredById_idx" ON "KnowledgeDocument"("retiredById");

ALTER TABLE "GenerationInstruction"
  ADD CONSTRAINT "GenerationInstruction_retiredById_fkey"
  FOREIGN KEY ("retiredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "KnowledgeDocument"
  ADD CONSTRAINT "KnowledgeDocument_retiredById_fkey"
  FOREIGN KEY ("retiredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
