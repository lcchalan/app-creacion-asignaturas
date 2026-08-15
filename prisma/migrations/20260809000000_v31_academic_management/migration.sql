-- v31 redefine la oferta académica desde catálogos administrables.
-- La aplicación está en construcción: se eliminan únicamente guías y asignaciones
-- de desarrollo. Usuarios, roles, documentos institucionales y configuración de IA
-- se conservan.
TRUNCATE TABLE "Project" CASCADE;

ALTER TABLE "Project" DROP CONSTRAINT "Project_teachingAssignmentId_fkey";
ALTER TABLE "Project" DROP COLUMN "teachingAssignmentId";

DROP TABLE "TeachingAssignment";
DROP TABLE "Course";
DROP TABLE "AcademicPeriod";

CREATE TABLE "AcademicLevel" (
  "id" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 100,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AcademicLevel_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AcademicLevel_code_key" ON "AcademicLevel"("code");
CREATE UNIQUE INDEX "AcademicLevel_name_key" ON "AcademicLevel"("name");

CREATE TABLE "Modality" (
  "id" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 100,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Modality_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Modality_code_key" ON "Modality"("code");
CREATE UNIQUE INDEX "Modality_name_key" ON "Modality"("name");

CREATE TABLE "AcademicUnit" (
  "id" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 100,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AcademicUnit_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AcademicUnit_code_key" ON "AcademicUnit"("code");
CREATE UNIQUE INDEX "AcademicUnit_name_key" ON "AcademicUnit"("name");

CREATE TABLE "AcademicProgram" (
  "id" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "academicLevelId" UUID NOT NULL,
  "academicUnitId" UUID NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AcademicProgram_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AcademicProgram_code_key" ON "AcademicProgram"("code");
CREATE UNIQUE INDEX "AcademicProgram_name_academicLevelId_academicUnitId_key"
  ON "AcademicProgram"("name", "academicLevelId", "academicUnitId");
CREATE INDEX "AcademicProgram_academicLevelId_academicUnitId_idx"
  ON "AcademicProgram"("academicLevelId", "academicUnitId");

CREATE TABLE "SubjectType" (
  "id" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 100,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SubjectType_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SubjectType_code_key" ON "SubjectType"("code");
CREATE UNIQUE INDEX "SubjectType_name_key" ON "SubjectType"("name");

CREATE TABLE "AcademicPeriod" (
  "id" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AcademicPeriod_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AcademicPeriod_code_key" ON "AcademicPeriod"("code");
CREATE UNIQUE INDEX "AcademicPeriod_name_key" ON "AcademicPeriod"("name");

CREATE TABLE "Course" (
  "id" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Course_code_key" ON "Course"("code");

CREATE TABLE "AcademicOffering" (
  "id" UUID NOT NULL,
  "courseId" UUID NOT NULL,
  "programId" UUID NOT NULL,
  "modalityId" UUID NOT NULL,
  "subjectTypeId" UUID NOT NULL,
  "periodId" UUID NOT NULL,
  "totalWeeks" INTEGER NOT NULL DEFAULT 8,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AcademicOffering_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AcademicOffering_courseId_programId_modalityId_subjectTypeI_key"
  ON "AcademicOffering"("courseId", "programId", "modalityId", "subjectTypeId", "periodId");
CREATE INDEX "AcademicOffering_programId_periodId_active_idx"
  ON "AcademicOffering"("programId", "periodId", "active");
CREATE INDEX "AcademicOffering_courseId_periodId_idx"
  ON "AcademicOffering"("courseId", "periodId");

CREATE TABLE "TeachingAssignment" (
  "id" UUID NOT NULL,
  "teacherId" UUID NOT NULL,
  "academicOfferingId" UUID NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt" TIMESTAMP(3),
  CONSTRAINT "TeachingAssignment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "TeachingAssignment_teacherId_active_idx"
  ON "TeachingAssignment"("teacherId", "active");
CREATE INDEX "TeachingAssignment_academicOfferingId_assignedAt_idx"
  ON "TeachingAssignment"("academicOfferingId", "assignedAt");
CREATE UNIQUE INDEX "TeachingAssignment_one_current_teacher_per_offering"
  ON "TeachingAssignment"("academicOfferingId") WHERE "endedAt" IS NULL;

ALTER TABLE "AcademicProgram" ADD CONSTRAINT "AcademicProgram_academicLevelId_fkey"
  FOREIGN KEY ("academicLevelId") REFERENCES "AcademicLevel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AcademicProgram" ADD CONSTRAINT "AcademicProgram_academicUnitId_fkey"
  FOREIGN KEY ("academicUnitId") REFERENCES "AcademicUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AcademicOffering" ADD CONSTRAINT "AcademicOffering_courseId_fkey"
  FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AcademicOffering" ADD CONSTRAINT "AcademicOffering_programId_fkey"
  FOREIGN KEY ("programId") REFERENCES "AcademicProgram"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AcademicOffering" ADD CONSTRAINT "AcademicOffering_modalityId_fkey"
  FOREIGN KEY ("modalityId") REFERENCES "Modality"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AcademicOffering" ADD CONSTRAINT "AcademicOffering_subjectTypeId_fkey"
  FOREIGN KEY ("subjectTypeId") REFERENCES "SubjectType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AcademicOffering" ADD CONSTRAINT "AcademicOffering_periodId_fkey"
  FOREIGN KEY ("periodId") REFERENCES "AcademicPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeachingAssignment" ADD CONSTRAINT "TeachingAssignment_teacherId_fkey"
  FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeachingAssignment" ADD CONSTRAINT "TeachingAssignment_academicOfferingId_fkey"
  FOREIGN KEY ("academicOfferingId") REFERENCES "AcademicOffering"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Project"
  ADD COLUMN "academicOfferingId" UUID NOT NULL,
  ADD COLUMN "teachingAssignmentId" UUID;
CREATE UNIQUE INDEX "Project_academicOfferingId_key" ON "Project"("academicOfferingId");
ALTER TABLE "Project" ADD CONSTRAINT "Project_academicOfferingId_fkey"
  FOREIGN KEY ("academicOfferingId") REFERENCES "AcademicOffering"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Project" ADD CONSTRAINT "Project_teachingAssignmentId_fkey"
  FOREIGN KEY ("teachingAssignmentId") REFERENCES "TeachingAssignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
