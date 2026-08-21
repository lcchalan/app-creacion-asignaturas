# v32.10.2.3 - Contexto autoritativo para generar la Guia Didactica

## Problema corregido

Despues de completar y confirmar el Plan Docente, la generacion de la Guia Didactica podia detenerse con un error de validacion del bloque `project`. Aunque v32.10.2.2 ya dejo de confiar en el payload redundante del navegador, la reconstruccion del contexto seguia tomando competencias y datos descriptivos desde campos historicos del `Project`.

## Fuente de verdad

La Guia se genera ahora con:

- datos de identificacion y catalogos desde `AcademicOffering` mediante `offeringSnapshot(...)`;
- competencias profesionales, resultados del perfil y competencias genericas desde `Project.outcomeMappings`, que es la matriz de contribucion confirmada para el Plan Docente;
- programacion semanal desde `TeachingPlan.content` mediante `planMatrixRows(...)`;
- bibliografia persistida del proyecto, con referencias de Guia reconstruidas a partir de la oferta cuando corresponde.

Los campos historicos de competencias almacenados directamente en `Project` dejan de bloquear la Guia si quedaron vacios o desactualizados despues de cambios de catalogos.

## Diagnostico

Si existe una inconsistencia real, el servidor devuelve la ruta concreta del dato invalido (por ejemplo `project.professionalProfileCompetencies`) en lugar de informar solamente `project`.

## Compatibilidad

No incorpora migraciones ni modifica el esquema Prisma. Los planes y guias existentes no se reescriben.
