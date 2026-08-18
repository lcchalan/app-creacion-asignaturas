# v32.2.1 — Reparación y diagnóstico de conocimiento oficial

## Motivo

La primera sincronización puede encontrar registros `KnowledgeDocument` activos cuya `storagePath` apunta a `knowledge/uploads/`, pero cuyo archivo físico ya no existe. Esto ocurre especialmente al trabajar con datos de PostgreSQL conservados mientras `knowledge/uploads/` no forma parte de Git.

## Cambios

- La sincronización realiza una validación previa de todos los documentos activos antes de modificar el manifiesto.
- Si el archivo indicado por PostgreSQL falta pero ya existe su copia canónica en `knowledge/official/`, se reutiliza esa copia.
- Si faltan ambos archivos, se informa la lista completa de documentos que deben reponerse o volver a cargarse.
- Después de una sincronización correcta, el registro activo en PostgreSQL cambia `storagePath` a `knowledge/official/<clave>.<ext>`. Así PostgreSQL y Git quedan sincronizados y una clonación futura no depende de `knowledge/uploads/`.
- Nuevo comando `npm run knowledge:check-official` para diagnosticar archivos faltantes sin modificar nada.

## Política de pruebas

Git conserva solamente la copia vigente de cada documento institucional activo. Los datos operativos de usuarios, catálogos, asignaciones, proyectos y revisiones continúan exclusivamente en PostgreSQL.
