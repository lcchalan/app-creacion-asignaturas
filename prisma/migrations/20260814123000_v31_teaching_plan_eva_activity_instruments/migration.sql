CREATE TYPE "TeachingActivityComponent" AS ENUM ('ACD', 'APE', 'AA');
CREATE TYPE "TeachingPlanInstrumentType" AS ENUM ('QUESTIONNAIRE', 'RUBRIC', 'CHECKLIST', 'RATING_SCALE', 'OTHER');
CREATE TYPE "QuestionnaireGradingMode" AS ENUM ('LAST_ATTEMPT', 'HIGHEST_GRADE');

CREATE TABLE "TeachingPlanActivity" (
    "id" UUID NOT NULL,
    "teachingPlanId" UUID NOT NULL,
    "sequenceOrder" INTEGER NOT NULL,
    "learningOutcome" TEXT NOT NULL,
    "weekNumber" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "component" "TeachingActivityComponent" NOT NULL,
    "description" TEXT NOT NULL,
    "unitContents" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "resources" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "weekAcdHours" INTEGER NOT NULL DEFAULT 0,
    "weekApeHours" INTEGER NOT NULL DEFAULT 0,
    "weekAaHours" INTEGER NOT NULL DEFAULT 0,
    "evaluatedCode" TEXT,
    "actualGrade" DOUBLE PRECISION,
    "weight" INTEGER,
    "workStrategies" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TeachingPlanActivity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TeachingPlanInstrument" (
    "id" UUID NOT NULL,
    "activityId" UUID NOT NULL,
    "type" "TeachingPlanInstrumentType" NOT NULL,
    "title" TEXT NOT NULL,
    "maximumScore" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "questionnaireGradingMode" "QuestionnaireGradingMode",
    "questionnaireQuestionCount" INTEGER,
    "questionnaireTimeMinutes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TeachingPlanInstrument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TeachingPlanInstrumentCriterion" (
    "id" UUID NOT NULL,
    "instrumentId" UUID NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TeachingPlanInstrumentCriterion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TeachingPlanInstrumentLevel" (
    "id" UUID NOT NULL,
    "criterionId" UUID NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "score" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TeachingPlanInstrumentLevel_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TeachingPlanActivity_teachingPlanId_sequenceOrder_weekNumber_sortOrder_key" ON "TeachingPlanActivity"("teachingPlanId", "sequenceOrder", "weekNumber", "sortOrder");
CREATE INDEX "TeachingPlanActivity_teachingPlanId_weekNumber_idx" ON "TeachingPlanActivity"("teachingPlanId", "weekNumber");
CREATE INDEX "TeachingPlanActivity_teachingPlanId_evaluatedCode_idx" ON "TeachingPlanActivity"("teachingPlanId", "evaluatedCode");
CREATE UNIQUE INDEX "TeachingPlanInstrument_activityId_key" ON "TeachingPlanInstrument"("activityId");
CREATE INDEX "TeachingPlanInstrument_type_idx" ON "TeachingPlanInstrument"("type");
CREATE UNIQUE INDEX "TeachingPlanInstrumentCriterion_instrumentId_sortOrder_key" ON "TeachingPlanInstrumentCriterion"("instrumentId", "sortOrder");
CREATE INDEX "TeachingPlanInstrumentCriterion_instrumentId_idx" ON "TeachingPlanInstrumentCriterion"("instrumentId");
CREATE UNIQUE INDEX "TeachingPlanInstrumentLevel_criterionId_sortOrder_key" ON "TeachingPlanInstrumentLevel"("criterionId", "sortOrder");
CREATE INDEX "TeachingPlanInstrumentLevel_criterionId_idx" ON "TeachingPlanInstrumentLevel"("criterionId");

ALTER TABLE "TeachingPlanActivity" ADD CONSTRAINT "TeachingPlanActivity_teachingPlanId_fkey" FOREIGN KEY ("teachingPlanId") REFERENCES "TeachingPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeachingPlanInstrument" ADD CONSTRAINT "TeachingPlanInstrument_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "TeachingPlanActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeachingPlanInstrumentCriterion" ADD CONSTRAINT "TeachingPlanInstrumentCriterion_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "TeachingPlanInstrument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeachingPlanInstrumentLevel" ADD CONSTRAINT "TeachingPlanInstrumentLevel_criterionId_fkey" FOREIGN KEY ("criterionId") REFERENCES "TeachingPlanInstrumentCriterion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
