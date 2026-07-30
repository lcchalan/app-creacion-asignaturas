ALTER TABLE "Project"
ADD COLUMN "professorName" TEXT NOT NULL DEFAULT '',
ADD COLUMN "subjectCode" TEXT NOT NULL DEFAULT '';

CREATE INDEX "Project_ownerId_subjectCode_idx"
ON "Project"("ownerId", "subjectCode");
