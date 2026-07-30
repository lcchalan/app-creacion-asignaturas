ALTER TYPE "ChecklistResult" ADD VALUE IF NOT EXISTS 'COMPLIES_PARTIALLY';

ALTER TABLE "GuideIndicator"
  ADD COLUMN "name" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "stage" "ReviewStage" NOT NULL DEFAULT 'PEER',
  ADD COLUMN "score" DECIMAL(8,4) NOT NULL DEFAULT 0,
  ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "GuideReview"
  ADD COLUMN "earnedScore" DECIMAL(8,4),
  ADD COLUMN "possibleScore" DECIMAL(8,4),
  ADD COLUMN "percentage" DECIMAL(6,2),
  ADD COLUMN "category" TEXT;

UPDATE "GuideIndicator"
SET "name" = CASE WHEN "name" = '' THEN "code" ELSE "name" END;

CREATE INDEX "GuideIndicator_versionId_stage_active_sortOrder_idx"
  ON "GuideIndicator"("versionId", "stage", "active", "sortOrder");
