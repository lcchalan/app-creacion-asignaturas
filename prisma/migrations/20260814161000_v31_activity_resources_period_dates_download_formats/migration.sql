ALTER TABLE "AcademicPeriod" ADD COLUMN "bimestralEvaluationAt" TIMESTAMP(3);
ALTER TABLE "TeachingPlanActivity" ADD COLUMN "resource" TEXT;
ALTER TABLE "TeachingPlanActivity" ADD COLUMN "hours" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "TeachingPlanActivity" ADD COLUMN "workStrategyItems" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
