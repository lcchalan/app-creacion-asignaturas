CREATE TYPE "ReviewStage" AS ENUM ('PEER', 'QUALITY', 'DIITEP');
CREATE TYPE "ChecklistResult" AS ENUM ('PENDING', 'COMPLIES', 'DOES_NOT_COMPLY', 'NOT_APPLICABLE');
CREATE TYPE "ReviewDecision" AS ENUM ('DRAFT', 'APPROVED', 'CHANGES_REQUESTED');

CREATE TABLE "IndicatorVersion" (
  "id" UUID NOT NULL,
  "version" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "status" "DocumentStatus" NOT NULL DEFAULT 'DRAFT',
  "createdById" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "activatedAt" TIMESTAMP(3),
  CONSTRAINT "IndicatorVersion_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "IndicatorVersion_version_key" ON "IndicatorVersion"("version");

CREATE TABLE "GuideIndicator" (
  "id" UUID NOT NULL,
  "versionId" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "required" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL,
  CONSTRAINT "GuideIndicator_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GuideIndicator_versionId_code_key" ON "GuideIndicator"("versionId", "code");
CREATE INDEX "GuideIndicator_versionId_sortOrder_idx" ON "GuideIndicator"("versionId", "sortOrder");

CREATE TABLE "GuideReview" (
  "id" UUID NOT NULL,
  "projectId" UUID NOT NULL,
  "indicatorVersionId" UUID NOT NULL,
  "stage" "ReviewStage" NOT NULL,
  "decision" "ReviewDecision" NOT NULL DEFAULT 'DRAFT',
  "generalObservation" TEXT,
  "reviewedById" UUID,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GuideReview_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GuideReview_projectId_stage_key" ON "GuideReview"("projectId", "stage");
CREATE INDEX "GuideReview_stage_decision_idx" ON "GuideReview"("stage", "decision");

CREATE TABLE "GuideReviewItem" (
  "id" UUID NOT NULL,
  "reviewId" UUID NOT NULL,
  "indicatorId" UUID NOT NULL,
  "result" "ChecklistResult" NOT NULL DEFAULT 'PENDING',
  "observation" TEXT,
  CONSTRAINT "GuideReviewItem_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GuideReviewItem_reviewId_indicatorId_key" ON "GuideReviewItem"("reviewId", "indicatorId");

ALTER TABLE "IndicatorVersion" ADD CONSTRAINT "IndicatorVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "GuideIndicator" ADD CONSTRAINT "GuideIndicator_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "IndicatorVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GuideReview" ADD CONSTRAINT "GuideReview_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GuideReview" ADD CONSTRAINT "GuideReview_indicatorVersionId_fkey" FOREIGN KEY ("indicatorVersionId") REFERENCES "IndicatorVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GuideReview" ADD CONSTRAINT "GuideReview_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "GuideReviewItem" ADD CONSTRAINT "GuideReviewItem_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "GuideReview"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GuideReviewItem" ADD CONSTRAINT "GuideReviewItem_indicatorId_fkey" FOREIGN KEY ("indicatorId") REFERENCES "GuideIndicator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
