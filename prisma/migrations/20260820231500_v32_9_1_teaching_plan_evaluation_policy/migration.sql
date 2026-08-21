-- v32.9.1 - Distribucion de evaluacion versionada por categoria del Plan Docente.
-- Conserva los Planes existentes enlazandolos a la politica institucional vigente al momento de la migracion.

CREATE TABLE "TeachingPlanEvaluationPolicyVersion" (
  "id" UUID NOT NULL,
  "category" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "status" "DocumentStatus" NOT NULL DEFAULT 'DRAFT',
  "rules" JSONB NOT NULL,
  "createdById" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "activatedAt" TIMESTAMP(3),
  CONSTRAINT "TeachingPlanEvaluationPolicyVersion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TeachingPlanEvaluationPolicyVersion_category_version_key"
  ON "TeachingPlanEvaluationPolicyVersion"("category", "version");
CREATE INDEX "TeachingPlanEvaluationPolicyVersion_category_status_idx"
  ON "TeachingPlanEvaluationPolicyVersion"("category", "status");
CREATE UNIQUE INDEX "TeachingPlanEvaluationPolicyVersion_one_active_per_category_idx"
  ON "TeachingPlanEvaluationPolicyVersion"("category") WHERE "status" = 'ACTIVE';

ALTER TABLE "TeachingPlanEvaluationPolicyVersion"
  ADD CONSTRAINT "TeachingPlanEvaluationPolicyVersion_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TeachingPlan"
  ADD COLUMN "evaluationPolicySnapshotId" UUID;
CREATE INDEX "TeachingPlan_evaluationPolicySnapshotId_idx"
  ON "TeachingPlan"("evaluationPolicySnapshotId");
ALTER TABLE "TeachingPlan"
  ADD CONSTRAINT "TeachingPlan_evaluationPolicySnapshotId_fkey"
  FOREIGN KEY ("evaluationPolicySnapshotId") REFERENCES "TeachingPlanEvaluationPolicyVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "TeachingPlanEvaluationPolicyVersion" ("id", "category", "version", "title", "status", "rules", "activatedAt")
VALUES
  (
    gen_random_uuid(), 'CONCEPTUAL', 1, 'Distribucion institucional - Conceptual', 'ACTIVE',
    '[{"code":"AC1","component":"ACD","week":2,"grade":1,"weight":10},{"code":"AC2","component":"AA","week":4,"grade":1,"weight":10},{"code":"AC3","component":"ACD","week":6,"grade":3,"weight":30},{"code":"AC4","component":"APE","week":7,"grade":2,"weight":20},{"code":"AC5","component":"AA","week":8,"grade":3,"weight":30}]'::jsonb,
    CURRENT_TIMESTAMP
  ),
  (
    gen_random_uuid(), 'ACTIVE', 1, 'Distribucion institucional - Activa', 'ACTIVE',
    '[{"code":"AC1","component":"ACD","week":2,"grade":0.5,"weight":5},{"code":"AC2","component":"APE","week":4,"grade":2,"weight":20},{"code":"AC3","component":"ACD","week":6,"grade":1.5,"weight":15},{"code":"AC4","component":"APE","week":7,"grade":3,"weight":30},{"code":"AC5","component":"AA","week":8,"grade":3,"weight":30}]'::jsonb,
    CURRENT_TIMESTAMP
  ),
  (
    gen_random_uuid(), 'INTEGRATING', 1, 'Distribucion institucional - Integradora', 'ACTIVE',
    '[{"code":"AC1","component":"ACD","week":2,"grade":1,"weight":10},{"code":"AC2","component":"APE","week":4,"grade":2,"weight":20},{"code":"AC3","component":"ACD","week":6,"grade":1,"weight":10},{"code":"AC4","component":"APE","week":7,"grade":4,"weight":40},{"code":"AC5","component":"AA","week":8,"grade":2,"weight":20}]'::jsonb,
    CURRENT_TIMESTAMP
  )
ON CONFLICT ("category", "version") DO NOTHING;

UPDATE "TeachingPlan" tp
SET "evaluationPolicySnapshotId" = policy."id"
FROM "Project" p
JOIN "AcademicOffering" ao ON ao."id" = p."academicOfferingId"
JOIN "SubjectType" st ON st."id" = ao."subjectTypeId"
JOIN "TeachingPlanEvaluationPolicyVersion" policy
  ON policy."category" = st."planCategory" AND policy."status" = 'ACTIVE'
WHERE tp."projectId" = p."id"
  AND tp."evaluationPolicySnapshotId" IS NULL;
