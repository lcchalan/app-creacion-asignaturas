ALTER TABLE "GenerationInstruction"
  ADD COLUMN "processes" TEXT[] NOT NULL DEFAULT ARRAY['GUIDE_GENERATION', 'GUIDE_ADAPTATION']::TEXT[];

ALTER TABLE "AdaptationProposal"
  ADD COLUMN "specificationSnapshotIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "TeachingPlan"
  ADD COLUMN "specificationSnapshotIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
