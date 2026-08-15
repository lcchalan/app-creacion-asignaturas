-- La referencia obligatoria de la guía forma parte de la bibliografía básica del Plan Docente.
-- Se conserva también su importancia pedagógica como dato editable y versionado por proyecto.
ALTER TABLE "Project"
  ADD COLUMN "guideReferenceImportance" TEXT NOT NULL DEFAULT '';

UPDATE "Project"
SET "guideReferenceImportance" =
  'Esta guía didáctica orienta al estudiante en el estudio de ' ||
  COALESCE(NULLIF(BTRIM("subjectName"), ''), 'la asignatura') ||
  ', organiza los contenidos, actividades y evaluaciones del periodo académico, y favorece el aprendizaje autónomo y el logro de los resultados de aprendizaje previstos.'
WHERE BTRIM("guideReferenceImportance") = '';
