-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "WeekStatus" AS ENUM ('PENDING', 'GENERATED', 'IN_REVIEW', 'APPROVED', 'REQUIRES_REVIEW');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AttachmentKind" AS ENUM ('MATRIX', 'BIBLIOGRAPHY', 'WEEK_ADJUSTMENT', 'GENERATED_IMAGE', 'KNOWLEDGE');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "passwordHash" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRole" (
    "userId" UUID NOT NULL,
    "roleId" UUID NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("userId","roleId")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "faculty" TEXT NOT NULL,
    "career" TEXT NOT NULL,
    "subjectName" TEXT NOT NULL,
    "modality" TEXT NOT NULL,
    "academicPeriod" TEXT NOT NULL,
    "totalWeeks" INTEGER NOT NULL,
    "basicBib" TEXT NOT NULL,
    "complementaryBib" TEXT NOT NULL,
    "reaBib" TEXT,
    "status" "ProjectStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Matrix" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "originalName" TEXT,
    "checksum" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Matrix_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatrixRow" (
    "id" UUID NOT NULL,
    "matrixId" UUID NOT NULL,
    "rowOrder" INTEGER NOT NULL,
    "weekNumber" INTEGER NOT NULL,
    "learningOutcome" TEXT NOT NULL,
    "unitContent" TEXT NOT NULL,
    "methodology" TEXT NOT NULL,

    CONSTRAINT "MatrixRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectWeek" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "weekNumber" INTEGER NOT NULL,
    "status" "WeekStatus" NOT NULL DEFAULT 'PENDING',
    "draftContent" TEXT,
    "approvedContent" TEXT,
    "approvedAt" TIMESTAMP(3),
    "currentVersion" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectWeek_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeekVersion" (
    "id" UUID NOT NULL,
    "projectWeekId" UUID NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "status" "WeekStatus" NOT NULL,
    "content" TEXT NOT NULL,
    "adjustmentInstructions" TEXT,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeekVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GenerationInstruction" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activatedAt" TIMESTAMP(3),

    CONSTRAINT "GenerationInstruction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeDocument" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "storagePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "checksum" TEXT,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activatedAt" TIMESTAMP(3),

    CONSTRAINT "KnowledgeDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" UUID NOT NULL,
    "projectId" UUID,
    "projectWeekId" UUID,
    "kind" "AttachmentKind" NOT NULL,
    "originalName" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "checksum" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "userId" UUID,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Role_code_key" ON "Role"("code");

-- CreateIndex
CREATE INDEX "Project_ownerId_updatedAt_idx" ON "Project"("ownerId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Matrix_projectId_key" ON "Matrix"("projectId");

-- CreateIndex
CREATE INDEX "MatrixRow_matrixId_weekNumber_idx" ON "MatrixRow"("matrixId", "weekNumber");

-- CreateIndex
CREATE UNIQUE INDEX "MatrixRow_matrixId_rowOrder_key" ON "MatrixRow"("matrixId", "rowOrder");

-- CreateIndex
CREATE INDEX "ProjectWeek_projectId_status_idx" ON "ProjectWeek"("projectId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectWeek_projectId_weekNumber_key" ON "ProjectWeek"("projectId", "weekNumber");

-- CreateIndex
CREATE UNIQUE INDEX "WeekVersion_projectWeekId_versionNumber_key" ON "WeekVersion"("projectWeekId", "versionNumber");

-- CreateIndex
CREATE INDEX "GenerationInstruction_key_status_idx" ON "GenerationInstruction"("key", "status");

-- CreateIndex
CREATE UNIQUE INDEX "GenerationInstruction_key_version_key" ON "GenerationInstruction"("key", "version");

-- CreateIndex
CREATE INDEX "KnowledgeDocument_key_status_idx" ON "KnowledgeDocument"("key", "status");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeDocument_key_version_key" ON "KnowledgeDocument"("key", "version");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Matrix" ADD CONSTRAINT "Matrix_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatrixRow" ADD CONSTRAINT "MatrixRow_matrixId_fkey" FOREIGN KEY ("matrixId") REFERENCES "Matrix"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectWeek" ADD CONSTRAINT "ProjectWeek_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeekVersion" ADD CONSTRAINT "WeekVersion_projectWeekId_fkey" FOREIGN KEY ("projectWeekId") REFERENCES "ProjectWeek"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeekVersion" ADD CONSTRAINT "WeekVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GenerationInstruction" ADD CONSTRAINT "GenerationInstruction_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeDocument" ADD CONSTRAINT "KnowledgeDocument_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_projectWeekId_fkey" FOREIGN KEY ("projectWeekId") REFERENCES "ProjectWeek"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
