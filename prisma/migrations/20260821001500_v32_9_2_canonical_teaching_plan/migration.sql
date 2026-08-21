-- v32.9.2: documento canónico persistido del Plan Docente.
CREATE TABLE "CanonicalTeachingPlanDocument" (
  "id" UUID NOT NULL,
  "teachingPlanId" UUID NOT NULL,
  "schemaVersion" TEXT NOT NULL,
  "document" JSONB NOT NULL,
  "checksum" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CanonicalTeachingPlanDocument_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CanonicalTeachingPlanDocument_teachingPlanId_key"
  ON "CanonicalTeachingPlanDocument"("teachingPlanId");
CREATE INDEX "CanonicalTeachingPlanDocument_schemaVersion_idx"
  ON "CanonicalTeachingPlanDocument"("schemaVersion");

ALTER TABLE "CanonicalTeachingPlanDocument"
  ADD CONSTRAINT "CanonicalTeachingPlanDocument_teachingPlanId_fkey"
  FOREIGN KEY ("teachingPlanId") REFERENCES "TeachingPlan"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
