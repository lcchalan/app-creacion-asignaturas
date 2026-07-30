-- Conserva las versiones históricas del documento duplicado, pero impide que
-- vuelvan a incorporarse al contexto de generación.
UPDATE "KnowledgeDocument"
SET "status" = 'ARCHIVED'
WHERE "key" = 'indicadores-generales'
  AND "status" <> 'ARCHIVED';
