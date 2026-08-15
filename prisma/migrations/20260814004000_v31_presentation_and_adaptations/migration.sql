ALTER TABLE "Project"
ADD COLUMN "microcurricularPresentation" TEXT NOT NULL DEFAULT '';

CREATE TABLE "InstitutionalSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedById" UUID,
    CONSTRAINT "InstitutionalSetting_pkey" PRIMARY KEY ("key")
);

ALTER TABLE "InstitutionalSetting"
ADD CONSTRAINT "InstitutionalSetting_updatedById_fkey"
FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "InstitutionalSetting" ("key", "value", "updatedAt") VALUES (
  'TEACHING_PLAN_CURRICULAR_ADAPTATIONS',
  'Para garantizar una educación de calidad acorde a las características del modelo educativo de la Universidad Técnica Particular de Loja, al principio de igualdad de oportunidades y a las necesidades educativas especiales asociadas o no a la discapacidad, se desarrollan adaptaciones curriculares no significativas o de grado dos que siguen una trayectoria de menor a mayor significación, considerando el aspecto metodológico, actividades de aprendizaje y el estilo individual de aprendizaje en cuanto a las estrategias a desarrollar. Estas adaptaciones se realizan en función de la identificación de las necesidades educativas en las primeras semanas de trabajo académico, con la finalidad de dar respuesta a la dificultad de aprendizaje y apoyar al desarrollo de las competencias del estudiante.',
  CURRENT_TIMESTAMP
) ON CONFLICT ("key") DO NOTHING;

-- Recupera la presentación ya generada en proyectos existentes para no perder el trabajo del profesor.
UPDATE "Project" AS p
SET "microcurricularPresentation" = COALESCE(tp."content"->>'presentation', '')
FROM "TeachingPlan" AS tp
WHERE tp."projectId" = p."id"
  AND COALESCE(p."microcurricularPresentation", '') = ''
  AND COALESCE(tp."content"->>'presentation', '') <> '';

-- Los planes existentes reciben una copia del texto institucional vigente al momento de esta migración.
UPDATE "TeachingPlan"
SET "content" = jsonb_set(
  "content",
  '{curricularAdaptations}',
  to_jsonb('Para garantizar una educación de calidad acorde a las características del modelo educativo de la Universidad Técnica Particular de Loja, al principio de igualdad de oportunidades y a las necesidades educativas especiales asociadas o no a la discapacidad, se desarrollan adaptaciones curriculares no significativas o de grado dos que siguen una trayectoria de menor a mayor significación, considerando el aspecto metodológico, actividades de aprendizaje y el estilo individual de aprendizaje en cuanto a las estrategias a desarrollar. Estas adaptaciones se realizan en función de la identificación de las necesidades educativas en las primeras semanas de trabajo académico, con la finalidad de dar respuesta a la dificultad de aprendizaje y apoyar al desarrollo de las competencias del estudiante.'::text),
  true
)
WHERE NOT ("content" ? 'curricularAdaptations');
