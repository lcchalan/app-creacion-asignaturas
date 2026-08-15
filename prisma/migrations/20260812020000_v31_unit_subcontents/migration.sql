-- v31: tercer nivel curricular opcional para contenidos de una unidad.
-- La numeracion (1.1.1, 1.1.2, etc.) se deriva de sortOrder; no se persiste como texto.

CREATE TABLE "AcademicOfferingUnitSubcontent" (
  "id" UUID NOT NULL,
  "contentId" UUID NOT NULL,
  "text" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AcademicOfferingUnitSubcontent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AcademicOfferingUnitSubcontent_contentId_sortOrder_key"
  ON "AcademicOfferingUnitSubcontent"("contentId", "sortOrder");
CREATE INDEX "AcademicOfferingUnitSubcontent_contentId_idx"
  ON "AcademicOfferingUnitSubcontent"("contentId");

ALTER TABLE "AcademicOfferingUnitSubcontent"
  ADD CONSTRAINT "AcademicOfferingUnitSubcontent_contentId_fkey"
  FOREIGN KEY ("contentId") REFERENCES "AcademicOfferingUnitContent"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
