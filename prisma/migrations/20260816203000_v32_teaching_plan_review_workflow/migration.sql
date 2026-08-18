CREATE TYPE "TeachingPlanReviewStageType" AS ENUM ('PEER', 'QUALITY', 'DIITEP', 'DIRECTOR');
CREATE TYPE "TeachingPlanWorkflowStatus" AS ENUM ('IN_REVIEW', 'CHANGES_REQUESTED', 'APPROVED', 'CANCELLED');
CREATE TYPE "TeachingPlanWorkflowStageStatus" AS ENUM ('WAITING', 'PENDING_REVIEW', 'CHANGES_REQUESTED', 'APPROVED');
CREATE TYPE "TeachingPlanNotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

CREATE TABLE "TeachingPlanReviewProcessConfig" (
  "id" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "updatedById" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TeachingPlanReviewProcessConfig_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TeachingPlanReviewStageConfig" (
  "id" UUID NOT NULL,
  "processConfigId" TEXT NOT NULL,
  "stage" "TeachingPlanReviewStageType" NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TeachingPlanReviewStageConfig_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TeachingPlanReviewerAssignment" (
  "id" UUID NOT NULL,
  "projectId" UUID NOT NULL,
  "stage" "TeachingPlanReviewStageType" NOT NULL,
  "reviewerId" UUID NOT NULL,
  "assignedById" UUID,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt" TIMESTAMP(3),
  CONSTRAINT "TeachingPlanReviewerAssignment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CareerDirectorAssignment" (
  "id" UUID NOT NULL,
  "programId" UUID NOT NULL,
  "directorId" UUID NOT NULL,
  "assignedById" UUID,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt" TIMESTAMP(3),
  CONSTRAINT "CareerDirectorAssignment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TeachingPlanIndicatorVersion" (
  "id" UUID NOT NULL,
  "version" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "status" "DocumentStatus" NOT NULL DEFAULT 'DRAFT',
  "createdById" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "activatedAt" TIMESTAMP(3),
  CONSTRAINT "TeachingPlanIndicatorVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TeachingPlanIndicator" (
  "id" UUID NOT NULL,
  "versionId" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL DEFAULT '',
  "description" TEXT NOT NULL,
  "stage" "TeachingPlanReviewStageType" NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "required" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL,
  CONSTRAINT "TeachingPlanIndicator_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TeachingPlanReviewWorkflow" (
  "id" UUID NOT NULL,
  "teachingPlanId" UUID NOT NULL,
  "indicatorVersionId" UUID NOT NULL,
  "status" "TeachingPlanWorkflowStatus" NOT NULL DEFAULT 'IN_REVIEW',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TeachingPlanReviewWorkflow_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TeachingPlanWorkflowStage" (
  "id" UUID NOT NULL,
  "workflowId" UUID NOT NULL,
  "stage" "TeachingPlanReviewStageType" NOT NULL,
  "sortOrder" INTEGER NOT NULL,
  "reviewerId" UUID,
  "status" "TeachingPlanWorkflowStageStatus" NOT NULL DEFAULT 'WAITING',
  "approvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TeachingPlanWorkflowStage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TeachingPlanReview" (
  "id" UUID NOT NULL,
  "workflowStageId" UUID NOT NULL,
  "indicatorVersionId" UUID NOT NULL,
  "attempt" INTEGER NOT NULL,
  "teachingPlanVersion" INTEGER NOT NULL,
  "decision" "ReviewDecision" NOT NULL DEFAULT 'DRAFT',
  "generalObservation" TEXT,
  "reviewedById" UUID,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TeachingPlanReview_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TeachingPlanReviewItem" (
  "id" UUID NOT NULL,
  "reviewId" UUID NOT NULL,
  "indicatorId" UUID NOT NULL,
  "result" "ChecklistResult" NOT NULL DEFAULT 'PENDING',
  "observation" TEXT,
  CONSTRAINT "TeachingPlanReviewItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TeachingPlanNotification" (
  "id" UUID NOT NULL,
  "workflowId" UUID NOT NULL,
  "reviewId" UUID,
  "event" TEXT NOT NULL,
  "stage" "TeachingPlanReviewStageType",
  "recipientUserId" UUID,
  "recipientEmail" TEXT NOT NULL,
  "recipientName" TEXT NOT NULL DEFAULT '',
  "subject" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "status" "TeachingPlanNotificationStatus" NOT NULL DEFAULT 'PENDING',
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "lastAttemptAt" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TeachingPlanNotification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TeachingPlanReviewStageConfig_processConfigId_stage_key"
  ON "TeachingPlanReviewStageConfig"("processConfigId", "stage");
CREATE INDEX "TeachingPlanReviewStageConfig_processConfigId_enabled_sortOrder_idx"
  ON "TeachingPlanReviewStageConfig"("processConfigId", "enabled", "sortOrder");

CREATE INDEX "TeachingPlanReviewerAssignment_projectId_stage_active_idx"
  ON "TeachingPlanReviewerAssignment"("projectId", "stage", "active");
CREATE INDEX "TeachingPlanReviewerAssignment_reviewerId_active_idx"
  ON "TeachingPlanReviewerAssignment"("reviewerId", "active");
CREATE UNIQUE INDEX "TeachingPlanReviewerAssignment_one_active_per_stage"
  ON "TeachingPlanReviewerAssignment"("projectId", "stage") WHERE "active" = true;

CREATE INDEX "CareerDirectorAssignment_programId_active_idx"
  ON "CareerDirectorAssignment"("programId", "active");
CREATE INDEX "CareerDirectorAssignment_directorId_active_idx"
  ON "CareerDirectorAssignment"("directorId", "active");
CREATE UNIQUE INDEX "CareerDirectorAssignment_one_active_per_program"
  ON "CareerDirectorAssignment"("programId") WHERE "active" = true;

CREATE UNIQUE INDEX "TeachingPlanIndicatorVersion_version_key"
  ON "TeachingPlanIndicatorVersion"("version");
CREATE UNIQUE INDEX "TeachingPlanIndicator_versionId_code_key"
  ON "TeachingPlanIndicator"("versionId", "code");
CREATE INDEX "TeachingPlanIndicator_versionId_stage_sortOrder_idx"
  ON "TeachingPlanIndicator"("versionId", "stage", "sortOrder");

CREATE UNIQUE INDEX "TeachingPlanReviewWorkflow_teachingPlanId_key"
  ON "TeachingPlanReviewWorkflow"("teachingPlanId");
CREATE INDEX "TeachingPlanReviewWorkflow_status_updatedAt_idx"
  ON "TeachingPlanReviewWorkflow"("status", "updatedAt");

CREATE UNIQUE INDEX "TeachingPlanWorkflowStage_workflowId_stage_key"
  ON "TeachingPlanWorkflowStage"("workflowId", "stage");
CREATE INDEX "TeachingPlanWorkflowStage_reviewerId_status_idx"
  ON "TeachingPlanWorkflowStage"("reviewerId", "status");
CREATE INDEX "TeachingPlanWorkflowStage_workflowId_sortOrder_idx"
  ON "TeachingPlanWorkflowStage"("workflowId", "sortOrder");

CREATE UNIQUE INDEX "TeachingPlanReview_workflowStageId_attempt_key"
  ON "TeachingPlanReview"("workflowStageId", "attempt");
CREATE INDEX "TeachingPlanReview_decision_reviewedAt_idx"
  ON "TeachingPlanReview"("decision", "reviewedAt");
CREATE UNIQUE INDEX "TeachingPlanReviewItem_reviewId_indicatorId_key"
  ON "TeachingPlanReviewItem"("reviewId", "indicatorId");

CREATE INDEX "TeachingPlanNotification_workflowId_createdAt_idx"
  ON "TeachingPlanNotification"("workflowId", "createdAt");
CREATE INDEX "TeachingPlanNotification_recipientUserId_status_idx"
  ON "TeachingPlanNotification"("recipientUserId", "status");
CREATE INDEX "TeachingPlanNotification_status_createdAt_idx"
  ON "TeachingPlanNotification"("status", "createdAt");

ALTER TABLE "TeachingPlanReviewProcessConfig"
  ADD CONSTRAINT "TeachingPlanReviewProcessConfig_updatedById_fkey"
  FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TeachingPlanReviewStageConfig"
  ADD CONSTRAINT "TeachingPlanReviewStageConfig_processConfigId_fkey"
  FOREIGN KEY ("processConfigId") REFERENCES "TeachingPlanReviewProcessConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeachingPlanReviewerAssignment"
  ADD CONSTRAINT "TeachingPlanReviewerAssignment_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeachingPlanReviewerAssignment"
  ADD CONSTRAINT "TeachingPlanReviewerAssignment_reviewerId_fkey"
  FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeachingPlanReviewerAssignment"
  ADD CONSTRAINT "TeachingPlanReviewerAssignment_assignedById_fkey"
  FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CareerDirectorAssignment"
  ADD CONSTRAINT "CareerDirectorAssignment_programId_fkey"
  FOREIGN KEY ("programId") REFERENCES "AcademicProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CareerDirectorAssignment"
  ADD CONSTRAINT "CareerDirectorAssignment_directorId_fkey"
  FOREIGN KEY ("directorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CareerDirectorAssignment"
  ADD CONSTRAINT "CareerDirectorAssignment_assignedById_fkey"
  FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TeachingPlanIndicatorVersion"
  ADD CONSTRAINT "TeachingPlanIndicatorVersion_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TeachingPlanIndicator"
  ADD CONSTRAINT "TeachingPlanIndicator_versionId_fkey"
  FOREIGN KEY ("versionId") REFERENCES "TeachingPlanIndicatorVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeachingPlanReviewWorkflow"
  ADD CONSTRAINT "TeachingPlanReviewWorkflow_teachingPlanId_fkey"
  FOREIGN KEY ("teachingPlanId") REFERENCES "TeachingPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeachingPlanReviewWorkflow"
  ADD CONSTRAINT "TeachingPlanReviewWorkflow_indicatorVersionId_fkey"
  FOREIGN KEY ("indicatorVersionId") REFERENCES "TeachingPlanIndicatorVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeachingPlanWorkflowStage"
  ADD CONSTRAINT "TeachingPlanWorkflowStage_workflowId_fkey"
  FOREIGN KEY ("workflowId") REFERENCES "TeachingPlanReviewWorkflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeachingPlanWorkflowStage"
  ADD CONSTRAINT "TeachingPlanWorkflowStage_reviewerId_fkey"
  FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TeachingPlanReview"
  ADD CONSTRAINT "TeachingPlanReview_workflowStageId_fkey"
  FOREIGN KEY ("workflowStageId") REFERENCES "TeachingPlanWorkflowStage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeachingPlanReview"
  ADD CONSTRAINT "TeachingPlanReview_indicatorVersionId_fkey"
  FOREIGN KEY ("indicatorVersionId") REFERENCES "TeachingPlanIndicatorVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeachingPlanReview"
  ADD CONSTRAINT "TeachingPlanReview_reviewedById_fkey"
  FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TeachingPlanReviewItem"
  ADD CONSTRAINT "TeachingPlanReviewItem_reviewId_fkey"
  FOREIGN KEY ("reviewId") REFERENCES "TeachingPlanReview"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeachingPlanReviewItem"
  ADD CONSTRAINT "TeachingPlanReviewItem_indicatorId_fkey"
  FOREIGN KEY ("indicatorId") REFERENCES "TeachingPlanIndicator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeachingPlanNotification"
  ADD CONSTRAINT "TeachingPlanNotification_workflowId_fkey"
  FOREIGN KEY ("workflowId") REFERENCES "TeachingPlanReviewWorkflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeachingPlanNotification"
  ADD CONSTRAINT "TeachingPlanNotification_reviewId_fkey"
  FOREIGN KEY ("reviewId") REFERENCES "TeachingPlanReview"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TeachingPlanNotification"
  ADD CONSTRAINT "TeachingPlanNotification_recipientUserId_fkey"
  FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
