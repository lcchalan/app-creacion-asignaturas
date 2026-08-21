# v32.10.2.2 - Generación de la Guía desde el Plan Docente persistido

## Problema corregido

Al iniciar la Guía Didáctica después de completar el Plan Docente, `/api/generate-week` validaba una copia completa de datos reenviada por el navegador (proyecto, programación, perfil académico y bibliografía) antes de consultar el Plan Docente guardado. Si el estado del navegador estaba incompleto o desactualizado, el servidor devolvía el mensaje genérico `La información enviada está incompleta o no es válida`, aunque el Plan Docente institucional ya estuviera completo y aprobado.

## Fuente única de verdad

A partir de esta versión el navegador envía únicamente:

- `projectId`;
- semana;
- instrucciones de regeneración, cuando existan;
- contenido actual, cuando se regenere;
- archivos adjuntos opcionales.

El backend reconstruye el contexto de generación desde PostgreSQL y el Plan Docente vigente:

- identificación de la asignatura y oferta;
- perfil académico;
- programación semanal derivada mediante `planMatrixRows`;
- bibliografía persistida;
- tipo de asignatura, modalidad y periodo;
- Plan Docente confirmado y aprobado institucionalmente.

Esto evita que una copia redundante del navegador bloquee la creación de la Guía.

## Validación

Si los datos persistidos realmente presentan una inconsistencia, el mensaje ahora identifica que el problema corresponde a la información institucional guardada y no al envío del navegador.

No se modifica Prisma ni se incorporan migraciones.
