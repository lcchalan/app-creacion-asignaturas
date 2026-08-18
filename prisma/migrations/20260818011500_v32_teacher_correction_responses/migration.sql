ALTER TABLE "TeachingPlanReviewItem"
  ADD COLUMN "teacherResponse" TEXT,
  ADD COLUMN "teacherResponseUpdatedAt" TIMESTAMP(3),
  ADD COLUMN "teacherAddressed" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "teacherAddressedAt" TIMESTAMP(3);

ALTER TABLE "TeachingPlanReview"
  ADD COLUMN "teacherGeneralResponse" TEXT,
  ADD COLUMN "teacherRespondedAt" TIMESTAMP(3);
