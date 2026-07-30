ALTER TABLE "KnowledgeDocument"
  ADD COLUMN "originalName" TEXT,
  ADD COLUMN "contentMarkdown" TEXT,
  ADD COLUMN "priority" INTEGER NOT NULL DEFAULT 100;

CREATE INDEX "KnowledgeDocument_status_priority_idx"
  ON "KnowledgeDocument"("status", "priority");
