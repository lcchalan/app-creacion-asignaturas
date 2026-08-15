-- v31: catalogo de departamentos docentes y referencia de guia didactica del plan docente.
-- Migracion correctiva: el codigo Prisma ya esperaba estas columnas/modelo, pero la migracion no fue incluida en el paquete anterior.

CREATE TABLE "TeacherDepartment" (
  "id" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 100,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TeacherDepartment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TeacherDepartment_code_key" ON "TeacherDepartment"("code");
CREATE UNIQUE INDEX "TeacherDepartment_name_key" ON "TeacherDepartment"("name");

ALTER TABLE "User"
  ADD COLUMN "teacherDepartmentId" UUID;

ALTER TABLE "User"
  ADD CONSTRAINT "User_teacherDepartmentId_fkey"
  FOREIGN KEY ("teacherDepartmentId") REFERENCES "TeacherDepartment"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Project"
  ADD COLUMN "guideReference" TEXT NOT NULL DEFAULT '';

-- Catalogo provisional. Podra reemplazarse posteriormente desde Administracion.
INSERT INTO "TeacherDepartment" ("id", "code", "name", "active", "sortOrder", "createdAt", "updatedAt") VALUES
  ('11111111-1111-4111-8111-111111111101', 'DEP-JUR', 'Departamento de Ciencias Juridicas', true, 10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('11111111-1111-4111-8111-111111111102', 'DEP-ADM', 'Departamento de Ciencias Empresariales', true, 20, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('11111111-1111-4111-8111-111111111103', 'DEP-EDU', 'Departamento de Ciencias de la Educacion', true, 30, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('11111111-1111-4111-8111-111111111104', 'DEP-TIC', 'Departamento de Ciencias de la Computacion y Electronica', true, 40, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('11111111-1111-4111-8111-111111111105', 'DEP-SAL', 'Departamento de Ciencias de la Salud', true, 50, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
