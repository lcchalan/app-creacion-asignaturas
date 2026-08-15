-- Intervalos institucionales de evaluación bimestral y recuperación.
ALTER TABLE "AcademicPeriod"
  ADD COLUMN "bimestralEvaluationStartAt" TIMESTAMP(3),
  ADD COLUMN "bimestralEvaluationEndAt" TIMESTAMP(3),
  ADD COLUMN "recoveryEvaluationStartAt" TIMESTAMP(3),
  ADD COLUMN "recoveryEvaluationEndAt" TIMESTAMP(3);

-- Conserva la fecha histórica como intervalo de un día cuando exista.
UPDATE "AcademicPeriod"
SET "bimestralEvaluationStartAt" = COALESCE("bimestralEvaluationStartAt", "bimestralEvaluationAt"),
    "bimestralEvaluationEndAt" = COALESCE("bimestralEvaluationEndAt", "bimestralEvaluationAt")
WHERE "bimestralEvaluationAt" IS NOT NULL;
