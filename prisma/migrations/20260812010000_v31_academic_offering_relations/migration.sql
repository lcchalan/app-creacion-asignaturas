-- v31: normaliza los elementos curriculares de AcademicOffering.
-- Los arreglos existentes se conservan temporalmente como espejo de compatibilidad
-- con el generador actual; las tablas relacionales pasan a guardar cada elemento
-- con su orden y sus relaciones explícitas.

CREATE TABLE "UtplGenericCompetency" (
  "id" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 100,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UtplGenericCompetency_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "UtplGenericCompetency_code_key" ON "UtplGenericCompetency"("code");
CREATE UNIQUE INDEX "UtplGenericCompetency_name_key" ON "UtplGenericCompetency"("name");

CREATE TABLE "AcademicOfferingLearningOutcome" (
  "id" UUID NOT NULL,
  "academicOfferingId" UUID NOT NULL,
  "text" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AcademicOfferingLearningOutcome_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AcademicOfferingLearningOutcome_academicOfferingId_sortOrder_key"
  ON "AcademicOfferingLearningOutcome"("academicOfferingId", "sortOrder");
CREATE INDEX "AcademicOfferingLearningOutcome_academicOfferingId_idx"
  ON "AcademicOfferingLearningOutcome"("academicOfferingId");

CREATE TABLE "AcademicOfferingProfessionalCompetency" (
  "id" UUID NOT NULL,
  "academicOfferingId" UUID NOT NULL,
  "text" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AcademicOfferingProfessionalCompetency_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AcademicOfferingProfessionalCompetency_academicOfferingId_sortOrder_key"
  ON "AcademicOfferingProfessionalCompetency"("academicOfferingId", "sortOrder");
CREATE INDEX "AcademicOfferingProfessionalCompetency_academicOfferingId_idx"
  ON "AcademicOfferingProfessionalCompetency"("academicOfferingId");

CREATE TABLE "AcademicOfferingGraduateProfileResult" (
  "id" UUID NOT NULL,
  "academicOfferingId" UUID NOT NULL,
  "text" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AcademicOfferingGraduateProfileResult_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AcademicOfferingGraduateProfileResult_academicOfferingId_sortOrder_key"
  ON "AcademicOfferingGraduateProfileResult"("academicOfferingId", "sortOrder");
CREATE INDEX "AcademicOfferingGraduateProfileResult_academicOfferingId_idx"
  ON "AcademicOfferingGraduateProfileResult"("academicOfferingId");

CREATE TABLE "AcademicOfferingGenericCompetency" (
  "academicOfferingId" UUID NOT NULL,
  "competencyId" UUID NOT NULL,
  "sortOrder" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AcademicOfferingGenericCompetency_pkey" PRIMARY KEY ("academicOfferingId", "competencyId")
);
CREATE UNIQUE INDEX "AcademicOfferingGenericCompetency_academicOfferingId_sortOrder_key"
  ON "AcademicOfferingGenericCompetency"("academicOfferingId", "sortOrder");
CREATE INDEX "AcademicOfferingGenericCompetency_competencyId_idx"
  ON "AcademicOfferingGenericCompetency"("competencyId");

CREATE TABLE "AcademicOfferingUnit" (
  "id" UUID NOT NULL,
  "academicOfferingId" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AcademicOfferingUnit_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AcademicOfferingUnit_academicOfferingId_sortOrder_key"
  ON "AcademicOfferingUnit"("academicOfferingId", "sortOrder");
CREATE INDEX "AcademicOfferingUnit_academicOfferingId_idx"
  ON "AcademicOfferingUnit"("academicOfferingId");

CREATE TABLE "AcademicOfferingUnitContent" (
  "id" UUID NOT NULL,
  "unitId" UUID NOT NULL,
  "text" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AcademicOfferingUnitContent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AcademicOfferingUnitContent_unitId_sortOrder_key"
  ON "AcademicOfferingUnitContent"("unitId", "sortOrder");
CREATE INDEX "AcademicOfferingUnitContent_unitId_idx"
  ON "AcademicOfferingUnitContent"("unitId");

ALTER TABLE "AcademicOfferingLearningOutcome" ADD CONSTRAINT "AcademicOfferingLearningOutcome_academicOfferingId_fkey"
  FOREIGN KEY ("academicOfferingId") REFERENCES "AcademicOffering"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AcademicOfferingProfessionalCompetency" ADD CONSTRAINT "AcademicOfferingProfessionalCompetency_academicOfferingId_fkey"
  FOREIGN KEY ("academicOfferingId") REFERENCES "AcademicOffering"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AcademicOfferingGraduateProfileResult" ADD CONSTRAINT "AcademicOfferingGraduateProfileResult_academicOfferingId_fkey"
  FOREIGN KEY ("academicOfferingId") REFERENCES "AcademicOffering"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AcademicOfferingGenericCompetency" ADD CONSTRAINT "AcademicOfferingGenericCompetency_academicOfferingId_fkey"
  FOREIGN KEY ("academicOfferingId") REFERENCES "AcademicOffering"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AcademicOfferingGenericCompetency" ADD CONSTRAINT "AcademicOfferingGenericCompetency_competencyId_fkey"
  FOREIGN KEY ("competencyId") REFERENCES "UtplGenericCompetency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AcademicOfferingUnit" ADD CONSTRAINT "AcademicOfferingUnit_academicOfferingId_fkey"
  FOREIGN KEY ("academicOfferingId") REFERENCES "AcademicOffering"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AcademicOfferingUnitContent" ADD CONSTRAINT "AcademicOfferingUnitContent_unitId_fkey"
  FOREIGN KEY ("unitId") REFERENCES "AcademicOfferingUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "UtplGenericCompetency" ("id", "code", "name", "active", "sortOrder", "updatedAt") VALUES
  ('11111111-1111-4111-8111-111111111111', 'DESARROLLO_PERSONAL_INTEGRAL', 'Desarrollo personal integral', true, 10, CURRENT_TIMESTAMP),
  ('22222222-2222-4222-8222-222222222222', 'TRABAJO_COLABORATIVO', 'Trabajo colaborativo', true, 20, CURRENT_TIMESTAMP),
  ('33333333-3333-4333-8333-333333333333', 'INNOVACION_EMPRENDIMIENTO_PROPOSITO', 'Innovación y emprendimiento con visión de propósito', true, 30, CURRENT_TIMESTAMP),
  ('44444444-4444-4444-8444-444444444444', 'MENTALIDAD_SOSTENIBLE', 'Mentalidad sostenible', true, 40, CURRENT_TIMESTAMP),
  ('55555555-5555-4555-8555-555555555555', 'CIUDADANIA_GLOBAL', 'Ciudadanía global', true, 50, CURRENT_TIMESTAMP);

INSERT INTO "AcademicOfferingLearningOutcome" ("id", "academicOfferingId", "text", "sortOrder", "updatedAt")
SELECT md5(o."id"::text || ':ra:' || x.ord::text)::uuid, o."id", x.value, x.ord::integer, CURRENT_TIMESTAMP
FROM "AcademicOffering" o
CROSS JOIN LATERAL unnest(o."learningOutcomes") WITH ORDINALITY AS x(value, ord)
WHERE btrim(x.value) <> '';

INSERT INTO "AcademicOfferingProfessionalCompetency" ("id", "academicOfferingId", "text", "sortOrder", "updatedAt")
SELECT md5(o."id"::text || ':cp:' || x.ord::text)::uuid, o."id", x.value, x.ord::integer, CURRENT_TIMESTAMP
FROM "AcademicOffering" o
CROSS JOIN LATERAL unnest(o."professionalProfileCompetencies") WITH ORDINALITY AS x(value, ord)
WHERE btrim(x.value) <> '';

INSERT INTO "AcademicOfferingGraduateProfileResult" ("id", "academicOfferingId", "text", "sortOrder", "updatedAt")
SELECT md5(o."id"::text || ':rpe:' || x.ord::text)::uuid, o."id", x.value, x.ord::integer, CURRENT_TIMESTAMP
FROM "AcademicOffering" o
CROSS JOIN LATERAL unnest(o."graduateProfileResults") WITH ORDINALITY AS x(value, ord)
WHERE btrim(x.value) <> '';

INSERT INTO "AcademicOfferingGenericCompetency" ("academicOfferingId", "competencyId", "sortOrder")
SELECT o."id", c."id", x.ord::integer
FROM "AcademicOffering" o
CROSS JOIN LATERAL unnest(o."utplGenericCompetencies") WITH ORDINALITY AS x(value, ord)
JOIN "UtplGenericCompetency" c ON c."name" = x.value
WHERE btrim(x.value) <> '';

DO $$
DECLARE
  offering_row RECORD;
  entry RECORD;
  current_unit_id UUID;
  current_content_order INTEGER;
  unit_order INTEGER;
  unit_title TEXT;
  content_text TEXT;
BEGIN
  FOR offering_row IN SELECT "id", "unitContents" FROM "AcademicOffering" LOOP
    current_unit_id := NULL;
    current_content_order := 0;
    unit_order := 0;
    FOR entry IN SELECT value, ord FROM unnest(offering_row."unitContents") WITH ORDINALITY AS x(value, ord) LOOP
      IF btrim(entry.value) = '' THEN
        CONTINUE;
      ELSIF entry.value ~* '^UNIDAD[[:space:]]*:' THEN
        unit_title := btrim(regexp_replace(entry.value, '^UNIDAD[[:space:]]*:', '', 'i'));
        IF unit_title <> '' THEN
          unit_order := unit_order + 1;
          current_unit_id := md5(offering_row."id"::text || ':unit:' || unit_order::text)::uuid;
          current_content_order := 0;
          INSERT INTO "AcademicOfferingUnit" ("id", "academicOfferingId", "title", "sortOrder", "updatedAt")
          VALUES (current_unit_id, offering_row."id", unit_title, unit_order, CURRENT_TIMESTAMP);
        END IF;
      ELSIF entry.value ~* '^CONTENIDO[[:space:]]*:' THEN
        content_text := btrim(regexp_replace(entry.value, '^CONTENIDO[[:space:]]*:', '', 'i'));
        IF content_text <> '' THEN
          IF current_unit_id IS NULL THEN
            unit_order := unit_order + 1;
            current_unit_id := md5(offering_row."id"::text || ':unit:' || unit_order::text)::uuid;
            current_content_order := 0;
            INSERT INTO "AcademicOfferingUnit" ("id", "academicOfferingId", "title", "sortOrder", "updatedAt")
            VALUES (current_unit_id, offering_row."id", 'Unidad migrada', unit_order, CURRENT_TIMESTAMP);
          END IF;
          current_content_order := current_content_order + 1;
          INSERT INTO "AcademicOfferingUnitContent" ("id", "unitId", "text", "sortOrder", "updatedAt")
          VALUES (
            md5(current_unit_id::text || ':content:' || current_content_order::text)::uuid,
            current_unit_id, content_text, current_content_order, CURRENT_TIMESTAMP
          );
        END IF;
      ELSE
        -- En datos v31 anteriores no existía separación inequívoca entre unidad y contenido.
        -- Se conserva literalmente cada entrada como título de unidad, sin inventar subtemas.
        unit_order := unit_order + 1;
        current_unit_id := md5(offering_row."id"::text || ':unit:' || unit_order::text)::uuid;
        current_content_order := 0;
        INSERT INTO "AcademicOfferingUnit" ("id", "academicOfferingId", "title", "sortOrder", "updatedAt")
        VALUES (current_unit_id, offering_row."id", btrim(entry.value), unit_order, CURRENT_TIMESTAMP);
      END IF;
    END LOOP;
  END LOOP;
END $$;
