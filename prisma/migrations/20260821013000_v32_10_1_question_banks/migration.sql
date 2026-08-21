-- v32.10.1: banco estructurado de preguntas por cuestionario del Plan Docente.

CREATE TABLE "TeachingPlanQuestionBank" (
  "id" UUID NOT NULL,
  "teachingPlanId" UUID NOT NULL,
  "evaluatedCode" TEXT NOT NULL,
  "minimumRequired" INTEGER NOT NULL,
  "topicScope" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "typeConfiguration" JSONB NOT NULL,
  "generationInstructions" TEXT NOT NULL DEFAULT '',
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "version" INTEGER NOT NULL DEFAULT 1,
  "approvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TeachingPlanQuestionBank_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TeachingPlanQuestion" (
  "id" UUID NOT NULL,
  "bankId" UUID NOT NULL,
  "sortOrder" INTEGER NOT NULL,
  "type" TEXT NOT NULL,
  "topic" TEXT NOT NULL,
  "prompt" TEXT NOT NULL,
  "options" JSONB NOT NULL,
  "answerKey" JSONB NOT NULL,
  "feedbackCorrect" TEXT NOT NULL,
  "feedbackIncorrect" TEXT NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'AI',
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TeachingPlanQuestion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TeachingPlanQuestionRevision" (
  "id" UUID NOT NULL,
  "questionId" UUID NOT NULL,
  "version" INTEGER NOT NULL,
  "snapshot" JSONB NOT NULL,
  "reason" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TeachingPlanQuestionRevision_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TeachingPlanQuestionBankRevision" (
  "id" UUID NOT NULL,
  "bankId" UUID NOT NULL,
  "version" INTEGER NOT NULL,
  "snapshot" JSONB NOT NULL,
  "reason" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TeachingPlanQuestionBankRevision_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TeachingPlanQuestionBank_teachingPlanId_evaluatedCode_key"
  ON "TeachingPlanQuestionBank"("teachingPlanId", "evaluatedCode");
CREATE INDEX "TeachingPlanQuestionBank_teachingPlanId_status_idx"
  ON "TeachingPlanQuestionBank"("teachingPlanId", "status");
CREATE UNIQUE INDEX "TeachingPlanQuestion_bankId_sortOrder_key"
  ON "TeachingPlanQuestion"("bankId", "sortOrder");
CREATE INDEX "TeachingPlanQuestion_bankId_type_idx"
  ON "TeachingPlanQuestion"("bankId", "type");
CREATE UNIQUE INDEX "TeachingPlanQuestionRevision_questionId_version_key"
  ON "TeachingPlanQuestionRevision"("questionId", "version");
CREATE INDEX "TeachingPlanQuestionRevision_questionId_createdAt_idx"
  ON "TeachingPlanQuestionRevision"("questionId", "createdAt");
CREATE UNIQUE INDEX "TeachingPlanQuestionBankRevision_bankId_version_key"
  ON "TeachingPlanQuestionBankRevision"("bankId", "version");
CREATE INDEX "TeachingPlanQuestionBankRevision_bankId_createdAt_idx"
  ON "TeachingPlanQuestionBankRevision"("bankId", "createdAt");

ALTER TABLE "TeachingPlanQuestionBank"
  ADD CONSTRAINT "TeachingPlanQuestionBank_teachingPlanId_fkey"
  FOREIGN KEY ("teachingPlanId") REFERENCES "TeachingPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeachingPlanQuestion"
  ADD CONSTRAINT "TeachingPlanQuestion_bankId_fkey"
  FOREIGN KEY ("bankId") REFERENCES "TeachingPlanQuestionBank"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeachingPlanQuestionRevision"
  ADD CONSTRAINT "TeachingPlanQuestionRevision_questionId_fkey"
  FOREIGN KEY ("questionId") REFERENCES "TeachingPlanQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeachingPlanQuestionBankRevision"
  ADD CONSTRAINT "TeachingPlanQuestionBankRevision_bankId_fkey"
  FOREIGN KEY ("bankId") REFERENCES "TeachingPlanQuestionBank"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "InstitutionalSetting" ("key", "value", "updatedAt")
VALUES ('TEACHING_PLAN_QUESTION_BANK_MINIMUM_QUESTIONS', '20', CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
