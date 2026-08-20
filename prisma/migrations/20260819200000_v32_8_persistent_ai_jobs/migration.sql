-- v32.8 - Cola persistente de IA y límites configurables de generación.
-- No modifica ni elimina información académica existente.

CREATE TABLE "AiGenerationJob" (
  "id" UUID NOT NULL,
  "requestedById" UUID NOT NULL,
  "projectId" UUID,
  "operation" TEXT NOT NULL,
  "targetKey" TEXT NOT NULL,
  "activeTargetKey" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "requestMethod" TEXT NOT NULL,
  "requestPath" TEXT NOT NULL,
  "requestPayload" JSONB,
  "status" TEXT NOT NULL DEFAULT 'QUEUED',
  "responseStatus" INTEGER,
  "responsePayload" JSONB,
  "errorMessage" TEXT,
  "quotaReserved" BOOLEAN NOT NULL DEFAULT true,
  "countsTowardLimit" BOOLEAN NOT NULL DEFAULT false,
  "technicalRetryCount" INTEGER NOT NULL DEFAULT 0,
  "nextRetryAt" TIMESTAMP(3),
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "lastHeartbeatAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AiGenerationJob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiGenerationRemoteCall" (
  "id" UUID NOT NULL,
  "jobId" UUID NOT NULL,
  "stepKey" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "providerResponseId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "responsePayload" JSONB,
  "outputText" TEXT,
  "errorMessage" TEXT,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AiGenerationRemoteCall_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AiGenerationJob_requestedById_idempotencyKey_key"
  ON "AiGenerationJob"("requestedById", "idempotencyKey");
CREATE UNIQUE INDEX "AiGenerationJob_requestedById_activeTargetKey_key"
  ON "AiGenerationJob"("requestedById", "activeTargetKey");
CREATE INDEX "AiGenerationJob_status_nextRetryAt_createdAt_idx"
  ON "AiGenerationJob"("status", "nextRetryAt", "createdAt");
CREATE INDEX "AiGenerationJob_requestedById_targetKey_countsTowardLimit_idx"
  ON "AiGenerationJob"("requestedById", "targetKey", "countsTowardLimit");
CREATE INDEX "AiGenerationJob_projectId_createdAt_idx"
  ON "AiGenerationJob"("projectId", "createdAt");

CREATE UNIQUE INDEX "AiGenerationRemoteCall_jobId_stepKey_key"
  ON "AiGenerationRemoteCall"("jobId", "stepKey");
CREATE INDEX "AiGenerationRemoteCall_providerResponseId_idx"
  ON "AiGenerationRemoteCall"("providerResponseId");

ALTER TABLE "AiGenerationJob"
  ADD CONSTRAINT "AiGenerationJob_requestedById_fkey"
  FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiGenerationJob"
  ADD CONSTRAINT "AiGenerationJob_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiGenerationRemoteCall"
  ADD CONSTRAINT "AiGenerationRemoteCall_jobId_fkey"
  FOREIGN KEY ("jobId") REFERENCES "AiGenerationJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "InstitutionalSetting" ("key", "value", "updatedAt")
VALUES ('AI_MAX_GENERATIONS_PER_CONTENT', '3', CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
