ALTER TABLE "Course"
  ADD COLUMN "sisCode" TEXT,
  ADD COLUMN "metacourseUrl" TEXT;

CREATE UNIQUE INDEX "Course_sisCode_key" ON "Course"("sisCode");
CREATE UNIQUE INDEX "Course_metacourseUrl_key" ON "Course"("metacourseUrl");

CREATE TYPE "InstitutionalDataIssueEmailStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

CREATE TABLE "InstitutionalDataIssue" (
  "id" UUID NOT NULL,
  "projectId" UUID NOT NULL,
  "reporterId" UUID NOT NULL,
  "description" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "emailRecipient" TEXT NOT NULL,
  "emailStatus" "InstitutionalDataIssueEmailStatus" NOT NULL DEFAULT 'PENDING',
  "emailError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InstitutionalDataIssue_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "InstitutionalDataIssue_projectId_createdAt_idx" ON "InstitutionalDataIssue"("projectId", "createdAt");
CREATE INDEX "InstitutionalDataIssue_reporterId_createdAt_idx" ON "InstitutionalDataIssue"("reporterId", "createdAt");
CREATE INDEX "InstitutionalDataIssue_status_createdAt_idx" ON "InstitutionalDataIssue"("status", "createdAt");

ALTER TABLE "InstitutionalDataIssue"
  ADD CONSTRAINT "InstitutionalDataIssue_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InstitutionalDataIssue"
  ADD CONSTRAINT "InstitutionalDataIssue_reporterId_fkey"
  FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
