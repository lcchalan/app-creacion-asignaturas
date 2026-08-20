-- v32.5: autoridades por carrera/programa + modalidad.
-- Mantiene el historial de Director/a y crea la asignación equivalente para Secretaría.

ALTER TABLE "CareerDirectorAssignment"
  ADD COLUMN "modalityId" UUID;

-- Asigna a cada registro histórico la primera modalidad registrada para la carrera.
WITH ranked_modalities AS (
  SELECT
    "programId",
    "modalityId",
    ROW_NUMBER() OVER (PARTITION BY "programId" ORDER BY "modalityId") AS rn
  FROM (
    SELECT DISTINCT "programId", "modalityId"
    FROM "AcademicOffering"
  ) modalities
)
UPDATE "CareerDirectorAssignment" assignment
SET "modalityId" = ranked."modalityId"
FROM ranked_modalities ranked
WHERE assignment."programId" = ranked."programId"
  AND ranked.rn = 1
  AND assignment."modalityId" IS NULL;

-- Replica la asignación histórica para las demás modalidades existentes de la misma carrera.
INSERT INTO "CareerDirectorAssignment" (
  "id", "programId", "modalityId", "directorId", "assignedById",
  "active", "assignedAt", "endedAt"
)
SELECT
  md5(assignment."id"::text || ':' || modalities."modalityId"::text)::uuid,
  assignment."programId",
  modalities."modalityId",
  assignment."directorId",
  assignment."assignedById",
  assignment."active",
  assignment."assignedAt",
  assignment."endedAt"
FROM "CareerDirectorAssignment" assignment
JOIN (
  SELECT DISTINCT "programId", "modalityId"
  FROM "AcademicOffering"
) modalities ON modalities."programId" = assignment."programId"
WHERE assignment."modalityId" IS NOT NULL
  AND modalities."modalityId" <> assignment."modalityId"
ON CONFLICT ("id") DO NOTHING;

-- Una asignación activa sin modalidad ya no puede resolver una autoridad de forma inequívoca.
UPDATE "CareerDirectorAssignment"
SET "active" = false,
    "endedAt" = COALESCE("endedAt", CURRENT_TIMESTAMP)
WHERE "active" = true
  AND "modalityId" IS NULL;

-- Si existieran duplicados históricos activos, conserva únicamente el más reciente por ámbito.
WITH ranked_active AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "programId", "modalityId"
      ORDER BY "assignedAt" DESC, "id" DESC
    ) AS rn
  FROM "CareerDirectorAssignment"
  WHERE "active" = true
    AND "modalityId" IS NOT NULL
)
UPDATE "CareerDirectorAssignment" assignment
SET "active" = false,
    "endedAt" = COALESCE(assignment."endedAt", CURRENT_TIMESTAMP)
FROM ranked_active ranked
WHERE assignment."id" = ranked."id"
  AND ranked.rn > 1;

ALTER TABLE "CareerDirectorAssignment"
  ADD CONSTRAINT "CareerDirectorAssignment_modalityId_fkey"
  FOREIGN KEY ("modalityId") REFERENCES "Modality"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "CareerDirectorAssignment_programId_modalityId_active_idx"
  ON "CareerDirectorAssignment"("programId", "modalityId", "active");

CREATE UNIQUE INDEX "CareerDirectorAssignment_one_active_scope_key"
  ON "CareerDirectorAssignment"("programId", "modalityId")
  WHERE "active" = true AND "modalityId" IS NOT NULL;

CREATE TABLE "CareerSecretaryAssignment" (
  "id" UUID NOT NULL,
  "programId" UUID NOT NULL,
  "modalityId" UUID NOT NULL,
  "secretaryId" UUID NOT NULL,
  "assignedById" UUID,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt" TIMESTAMP(3),

  CONSTRAINT "CareerSecretaryAssignment_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "CareerSecretaryAssignment"
  ADD CONSTRAINT "CareerSecretaryAssignment_programId_fkey"
  FOREIGN KEY ("programId") REFERENCES "AcademicProgram"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CareerSecretaryAssignment"
  ADD CONSTRAINT "CareerSecretaryAssignment_modalityId_fkey"
  FOREIGN KEY ("modalityId") REFERENCES "Modality"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CareerSecretaryAssignment"
  ADD CONSTRAINT "CareerSecretaryAssignment_secretaryId_fkey"
  FOREIGN KEY ("secretaryId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CareerSecretaryAssignment"
  ADD CONSTRAINT "CareerSecretaryAssignment_assignedById_fkey"
  FOREIGN KEY ("assignedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "CareerSecretaryAssignment_programId_modalityId_active_idx"
  ON "CareerSecretaryAssignment"("programId", "modalityId", "active");

CREATE INDEX "CareerSecretaryAssignment_secretaryId_active_idx"
  ON "CareerSecretaryAssignment"("secretaryId", "active");

CREATE UNIQUE INDEX "CareerSecretaryAssignment_one_active_scope_key"
  ON "CareerSecretaryAssignment"("programId", "modalityId")
  WHERE "active" = true;

-- Rol institucional para seguimiento y reportería. No concede aprobación académica.
INSERT INTO "Role" ("id", "code", "name", "description")
VALUES (
  '5e4356fb-5a2f-4e36-8f25-6d837543f2d5',
  'SECRETARY',
  'Secretaría de carrera',
  'Consulta el seguimiento de Planes Docentes y Guías Didácticas de las carreras y modalidades asignadas.'
)
ON CONFLICT ("code") DO UPDATE
SET "name" = EXCLUDED."name",
    "description" = EXCLUDED."description";
