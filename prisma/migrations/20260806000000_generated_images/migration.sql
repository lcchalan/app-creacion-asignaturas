CREATE TABLE "GeneratedImage" (
    "id" UUID NOT NULL,
    "projectId" UUID,
    "projectWeekId" UUID,
    "weekNumber" INTEGER NOT NULL,
    "figureNumber" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "altText" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'Elaboración propia mediante IA',
    "prompt" TEXT NOT NULL,
    "style" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT 'image/png',
    "imageData" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GeneratedImage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "GeneratedImage_projectId_weekNumber_idx" ON "GeneratedImage"("projectId", "weekNumber");
CREATE INDEX "GeneratedImage_projectWeekId_idx" ON "GeneratedImage"("projectWeekId");

ALTER TABLE "GeneratedImage"
ADD CONSTRAINT "GeneratedImage_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GeneratedImage"
ADD CONSTRAINT "GeneratedImage_projectWeekId_fkey"
FOREIGN KEY ("projectWeekId") REFERENCES "ProjectWeek"("id") ON DELETE CASCADE ON UPDATE CASCADE;
