CREATE TABLE "CanonicalGuideDocument" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "schemaVersion" TEXT NOT NULL,
    "document" JSONB NOT NULL,
    "checksum" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CanonicalGuideDocument_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CanonicalGuideDocument_projectId_key"
ON "CanonicalGuideDocument"("projectId");

CREATE INDEX "CanonicalGuideDocument_schemaVersion_idx"
ON "CanonicalGuideDocument"("schemaVersion");

ALTER TABLE "CanonicalGuideDocument"
ADD CONSTRAINT "CanonicalGuideDocument_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "Project"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
