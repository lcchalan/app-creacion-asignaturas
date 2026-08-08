ALTER TABLE "Project"
ADD COLUMN "professionalProfileCompetencies" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "graduateProfileResults" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "utplGenericCompetencies" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
