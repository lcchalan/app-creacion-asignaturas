-- Bibliografia estructurada por proyecto
CREATE TYPE "BibliographyEntryType" AS ENUM ('BASIC', 'COMPLEMENTARY', 'REA');

CREATE TABLE "ProjectBibliographyEntry" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "type" "BibliographyEntryType" NOT NULL,
    "citation" TEXT NOT NULL DEFAULT '',
    "title" TEXT NOT NULL DEFAULT '',
    "url" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProjectBibliographyEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProjectBibliographyEntry_projectId_type_sortOrder_idx"
ON "ProjectBibliographyEntry"("projectId", "type", "sortOrder");

ALTER TABLE "ProjectBibliographyEntry"
ADD CONSTRAINT "ProjectBibliographyEntry_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Conserva y normaliza los datos históricos existentes como registros individuales.
INSERT INTO "ProjectBibliographyEntry" ("id", "projectId", "type", "citation", "sortOrder", "updatedAt")
SELECT gen_random_uuid(), p."id", 'BASIC'::"BibliographyEntryType", trim(x.value), x.ordinality * 10, CURRENT_TIMESTAMP
FROM "Project" p
CROSS JOIN LATERAL unnest(string_to_array(COALESCE(p."basicBib", ''), E'\n')) WITH ORDINALITY AS x(value, ordinality)
WHERE trim(x.value) <> '';

INSERT INTO "ProjectBibliographyEntry" ("id", "projectId", "type", "citation", "sortOrder", "updatedAt")
SELECT gen_random_uuid(), p."id", 'COMPLEMENTARY'::"BibliographyEntryType", trim(x.value), x.ordinality * 10, CURRENT_TIMESTAMP
FROM "Project" p
CROSS JOIN LATERAL unnest(string_to_array(COALESCE(p."complementaryBib", ''), E'\n')) WITH ORDINALITY AS x(value, ordinality)
WHERE trim(x.value) <> '';

INSERT INTO "ProjectBibliographyEntry" ("id", "projectId", "type", "citation", "sortOrder", "updatedAt")
SELECT gen_random_uuid(), p."id", 'REA'::"BibliographyEntryType", trim(x.value), x.ordinality * 10, CURRENT_TIMESTAMP
FROM "Project" p
CROSS JOIN LATERAL unnest(string_to_array(COALESCE(p."reaBib", ''), E'\n')) WITH ORDINALITY AS x(value, ordinality)
WHERE trim(x.value) <> '';
