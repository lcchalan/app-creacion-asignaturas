ALTER TABLE "Project"
ADD COLUMN "currentStep" INTEGER NOT NULL DEFAULT 1;

UPDATE "Project" p
SET "currentStep" = CASE
  WHEN EXISTS (SELECT 1 FROM "ProjectWeek" w WHERE w."projectId" = p."id" AND (w."status" <> 'PENDING' OR w."draftContent" IS NOT NULL OR w."approvedContent" IS NOT NULL)) THEN 5
  WHEN EXISTS (SELECT 1 FROM "TeachingPlan" tp WHERE tp."projectId" = p."id") THEN 4
  WHEN p."institutionalDataReviewedAt" IS NOT NULL THEN 4
  ELSE 1
END;
