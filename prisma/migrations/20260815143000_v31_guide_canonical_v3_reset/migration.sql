-- LUIS v31 - Guía Didáctica canónica v3
-- El sistema está todavía en construcción y no contiene Guías reales que deban conservarse.
-- Se eliminan únicamente artefactos de Guía v1/v2 para iniciar el contrato v3 sin capas de compatibilidad.

DELETE FROM "GuideReviewItem";
DELETE FROM "GuideReview";
DELETE FROM "WeekVersion";
DELETE FROM "GeneratedImage";
DELETE FROM "ProjectWeek";
DELETE FROM "CanonicalGuideDocument";

DELETE FROM "AdaptationChange"
WHERE "proposalId" IN (
  SELECT "id" FROM "AdaptationProposal" WHERE "target" = 'GUIDE'
);
DELETE FROM "AdaptationProposal" WHERE "target" = 'GUIDE';

UPDATE "Project"
SET
  "currentWeek" = 1,
  "currentStep" = CASE
    WHEN EXISTS (SELECT 1 FROM "TeachingPlan" tp WHERE tp."projectId" = "Project"."id") THEN 4
    ELSE LEAST("currentStep", 3)
  END,
  "adaptationGuideApprovedAt" = NULL,
  "specificationSnapshotIds" = ARRAY[]::TEXT[],
  "documentSnapshotIds" = ARRAY[]::TEXT[],
  "indicatorVersionSnapshotId" = NULL,
  "status" = CASE
    WHEN "status" = 'COMPLETED' THEN 'IN_PROGRESS'::"ProjectStatus"
    ELSE "status"
  END
WHERE "status" <> 'ARCHIVED';
