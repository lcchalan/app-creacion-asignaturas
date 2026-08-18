# v32.3.1 · Suspensión segura del proceso de revisión del Plan Docente

## Objetivo

Cuando Administración desactiva globalmente el proceso institucional de revisión y aprobación del Plan Docente, los flujos que ya estaban en curso no se borran ni se aprueban automáticamente: quedan suspendidos por configuración y se reanudan al volver a habilitar el proceso.

## Reglas funcionales

- Las asignaciones de Par académico, Calidad, DIITEP y Dirección de carrera se conservan en base de datos.
- Las bandejas de revisión no muestran Planes mientras el proceso global está desactivado.
- Un revisor no puede abrir una etapa mediante enlace directo, guardar borradores, aprobar ni solicitar correcciones durante la suspensión.
- No se pueden reintentar notificaciones del proceso mientras esté desactivado, para evitar enviar tareas que no pueden atenderse.
- Si el Plan tenía `CHANGES_REQUESTED`, el docente conserva las observaciones, puede editar el Plan y guardar respuestas, pero no puede reenviar las correcciones hasta la reactivación.
- Las aprobaciones de etapas anteriores, observaciones, respuestas, intentos y versiones se conservan sin cambios.
- Un flujo con `IN_REVIEW` permanece bloqueado para edición del Plan, preservando exactamente la versión que estaba siendo revisada.
- Si el proceso global está desactivado, la aprobación institucional no es un requisito para iniciar la Guía Didáctica. La confirmación docente del Plan sigue siendo obligatoria. Por seguridad, un Plan con correcciones solicitadas mantiene esa confirmación invalidada hasta resolver el ciclo de correcciones.
- Al reactivar el proceso, los flujos continúan desde el estado y la etapa en que quedaron; no se reinician aprobaciones previas.

## Administración

Antes de desactivar el proceso, la interfaz muestra una advertencia con el número de Planes actualmente en revisión y con correcciones solicitadas. La acción se registra en auditoría junto con la cantidad de flujos activos afectados.

## Implementación

No se agrega un nuevo estado persistente `SUSPENDED`: la suspensión se deriva de `TeachingPlanReviewProcessConfig.enabled = false` combinada con un workflow en `IN_REVIEW` o `CHANGES_REQUESTED`. Esto evita mutar el historial académico y permite una reactivación exacta sin migraciones de estado.

## Base de datos

Esta actualización no requiere migración Prisma.
