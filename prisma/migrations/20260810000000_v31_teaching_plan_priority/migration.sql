-- Prioridad v31: oferta académica masiva, entradas del profesor y plan docente.
-- El circuito de revisión institucional se mantiene fuera de este incremento.

ALTER TABLE "User"
  ADD COLUMN "thirdLevelDegrees" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "fourthLevelDegrees" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "teacherFaculty" TEXT,
  ADD COLUMN "teacherDepartment" TEXT,
  ADD COLUMN "phone" TEXT,
  ADD COLUMN "shortCv" TEXT;

ALTER TABLE "SubjectType" ADD COLUMN "planCategory" TEXT;
UPDATE "SubjectType"
SET "planCategory" = CASE
  WHEN "code" = 'TEORICA' THEN 'CONCEPTUAL'
  WHEN "code" = 'PRACTICA' THEN 'ACTIVE'
  WHEN "code" = 'PROYECTO' THEN 'INTEGRATING'
  ELSE NULL
END;

ALTER TABLE "AcademicOffering"
  ADD COLUMN "code" TEXT,
  ADD COLUMN "credits" DECIMAL(6, 2),
  ADD COLUMN "acdHours" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "apeHours" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "aaHours" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "semester" TEXT,
  ADD COLUMN "description" TEXT,
  ADD COLUMN "prerequisites" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "learningOutcomes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "professionalProfileCompetencies" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "graduateProfileResults" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "utplGenericCompetencies" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "unitContents" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

UPDATE "AcademicOffering"
SET "code" = 'OF-' || UPPER(REPLACE("id"::TEXT, '-', ''))
WHERE "code" IS NULL;

ALTER TABLE "AcademicOffering" ALTER COLUMN "code" SET NOT NULL;
CREATE UNIQUE INDEX "AcademicOffering_code_key" ON "AcademicOffering"("code");

ALTER TABLE "Project"
  ADD COLUMN "institutionalDataReviewedAt" TIMESTAMP(3),
  ADD COLUMN "outcomeMappings" JSONB,
  ADD COLUMN "teacherProfileSnapshot" JSONB;

ALTER TABLE "KnowledgeDocument"
  ADD COLUMN "resourceKind" TEXT NOT NULL DEFAULT 'INSTITUTIONAL_DOCUMENT',
  ADD COLUMN "appliesToPlan" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "appliesToGuide" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "effectiveFrom" TIMESTAMP(3),
  ADD COLUMN "provisional" BOOLEAN NOT NULL DEFAULT false;

UPDATE "KnowledgeDocument"
SET "appliesToPlan" = true
WHERE "key" = 'metodologias-activas';

CREATE TABLE "TeachingPlan" (
  "id" UUID NOT NULL,
  "projectId" UUID NOT NULL,
  "schemaVersion" TEXT NOT NULL DEFAULT '1.0.0',
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "content" JSONB NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "templateSnapshotId" UUID,
  "promptSnapshotId" UUID,
  "documentSnapshotIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TeachingPlan_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TeachingPlan_projectId_key" ON "TeachingPlan"("projectId");
CREATE INDEX "TeachingPlan_status_updatedAt_idx" ON "TeachingPlan"("status", "updatedAt");
ALTER TABLE "TeachingPlan" ADD CONSTRAINT "TeachingPlan_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
