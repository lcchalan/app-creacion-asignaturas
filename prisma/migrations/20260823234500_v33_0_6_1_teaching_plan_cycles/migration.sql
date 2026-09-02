-- V33.0.6.1 - ciclos institucionales del Plan Docente
-- Los TeachingPlan existentes se convierten en ciclo 1 y permanecen como Plan actual.

ALTER TABLE "Project"
ADD COLUMN "currentTeachingPlanId" UUID;

ALTER TABLE "TeachingPlan"
ADD COLUMN "cycleNumber" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "administrativelyClosedAt" TIMESTAMP(3),
ADD COLUMN "administrativelyClosedById" UUID,
ADD COLUMN "administrativeCloseReason" TEXT,
ADD COLUMN "administrativeCloseNotes" TEXT,
ADD COLUMN "reusedFromTeachingPlanId" UUID;

-- Hasta esta migracion projectId era unico, por lo que cada proyecto tiene como maximo un Plan.
UPDATE "Project" AS project
SET "currentTeachingPlanId" = plan."id"
FROM "TeachingPlan" AS plan
WHERE plan."projectId" = project."id";

DROP INDEX IF EXISTS "TeachingPlan_projectId_key";

CREATE UNIQUE INDEX "TeachingPlan_projectId_cycleNumber_key"
ON "TeachingPlan"("projectId", "cycleNumber");

CREATE UNIQUE INDEX "Project_currentTeachingPlanId_key"
ON "Project"("currentTeachingPlanId");

CREATE INDEX "TeachingPlan_projectId_administrativelyClosedAt_idx"
ON "TeachingPlan"("projectId", "administrativelyClosedAt");

CREATE INDEX "TeachingPlan_reusedFromTeachingPlanId_idx"
ON "TeachingPlan"("reusedFromTeachingPlanId");

CREATE INDEX "TeachingPlan_administrativelyClosedById_idx"
ON "TeachingPlan"("administrativelyClosedById");

ALTER TABLE "Project"
ADD CONSTRAINT "Project_currentTeachingPlanId_fkey"
FOREIGN KEY ("currentTeachingPlanId") REFERENCES "TeachingPlan"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TeachingPlan"
ADD CONSTRAINT "TeachingPlan_administrativelyClosedById_fkey"
FOREIGN KEY ("administrativelyClosedById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TeachingPlan"
ADD CONSTRAINT "TeachingPlan_reusedFromTeachingPlanId_fkey"
FOREIGN KEY ("reusedFromTeachingPlanId") REFERENCES "TeachingPlan"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
